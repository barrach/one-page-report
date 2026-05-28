/**
 * useParserMemory — Self-learning parser pattern memory
 * Stores, retrieves, and matches patterns from previous imports.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@budget/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { DetectedBlock, BlockType } from "@budget/lib/universalParser";

export interface ParserPattern {
  id: string;
  pattern_name: string;
  block_type: string;
  characteristics: {
    columns: string[];
    hasNumericData?: boolean;
    hasPeriodColumns?: boolean;
    hasCurrencyData?: boolean;
    columnCount?: number;
  };
  sample_columns: string[];
  confidence: number;
  times_confirmed: number;
  times_corrected: number;
  source_file_name: string | null;
}

export interface PatternMatch {
  patternId: string;
  patternName: string;
  similarity: number;
  suggestedType: BlockType;
  confidence: number;
  autoApplied: boolean;
}

function computeSimilarity(
  blockCols: string[],
  patternCols: string[],
  block: Pick<DetectedBlock, "hasNumericData" | "hasPeriodColumns" | "hasCurrencyData" | "columnCount">,
  chars: ParserPattern["characteristics"]
): number {
  if (patternCols.length === 0 && blockCols.length === 0) return 0.3;
  if (patternCols.length === 0 || blockCols.length === 0) return 0.1;

  // Column name match (40%)
  const normBlock = blockCols.map(c => c.toLowerCase().trim());
  const normPattern = patternCols.map(c => c.toLowerCase().trim());
  const matches = normBlock.filter(c => normPattern.includes(c)).length;
  const colScore = matches / Math.max(normPattern.length, 1);

  // Data type match (30%)
  let typeScore = 0;
  let typeChecks = 0;
  if (chars.hasNumericData !== undefined) {
    typeChecks++;
    if (block.hasNumericData === chars.hasNumericData) typeScore++;
  }
  if (chars.hasPeriodColumns !== undefined) {
    typeChecks++;
    if (block.hasPeriodColumns === chars.hasPeriodColumns) typeScore++;
  }
  if (chars.hasCurrencyData !== undefined) {
    typeChecks++;
    if (block.hasCurrencyData === chars.hasCurrencyData) typeScore++;
  }
  const dataScore = typeChecks > 0 ? typeScore / typeChecks : 0.5;

  // Structure match (30%)
  const colCountDiff = chars.columnCount
    ? 1 - Math.min(Math.abs(block.columnCount - chars.columnCount) / Math.max(chars.columnCount, 1), 1)
    : 0.5;

  return colScore * 0.4 + dataScore * 0.3 + colCountDiff * 0.3;
}

export function useParserMemory() {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<ParserPattern[]>([]);
  const [loading, setLoading] = useState(false);

  // Load all patterns for the current user
  const loadPatterns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("parser_patterns")
        .select("*")
        .order("confidence", { ascending: false });
      if (data) {
        setPatterns(data.map(d => ({
          ...d,
          characteristics: (d.characteristics as ParserPattern["characteristics"]) || { columns: [] },
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPatterns(); }, [loadPatterns]);

  // Match a block against stored patterns
  const matchBlock = useCallback((block: DetectedBlock): PatternMatch | null => {
    if (patterns.length === 0) return null;

    let bestMatch: PatternMatch | null = null;
    let bestSim = 0;

    for (const p of patterns) {
      const sim = computeSimilarity(
        block.columnsDetected,
        p.sample_columns,
        block,
        p.characteristics,
      );
      // Weight by stored confidence
      const weightedSim = sim * (0.7 + 0.3 * p.confidence);
      if (weightedSim > bestSim) {
        bestSim = weightedSim;
        bestMatch = {
          patternId: p.id,
          patternName: p.pattern_name,
          similarity: Math.round(weightedSim * 100),
          suggestedType: p.block_type as BlockType,
          confidence: p.confidence,
          autoApplied: weightedSim > 0.8,
        };
      }
    }

    return bestSim >= 0.4 ? bestMatch : null;
  }, [patterns]);

  // Apply memory to an array of blocks — returns enhanced blocks
  const applyMemory = useCallback((blocks: DetectedBlock[]): { blocks: DetectedBlock[]; matches: Map<string, PatternMatch> } => {
    const matches = new Map<string, PatternMatch>();

    const enhanced = blocks.map(block => {
      const match = matchBlock(block);
      if (!match) return block;

      matches.set(block.id, match);

      if (match.autoApplied) {
        return {
          ...block,
          type: match.suggestedType,
          suggestedType: match.suggestedType,
          confidence: match.similarity,
          confirmed: true,
        };
      }
      // Suggestion only — update suggestedType but don't auto-confirm
      if (match.similarity >= 50) {
        return {
          ...block,
          suggestedType: match.suggestedType,
          confidence: Math.max(block.confidence, match.similarity),
        };
      }
      return block;
    });

    return { blocks: enhanced, matches };
  }, [matchBlock]);

  // Save/update pattern on user confirmation
  const learnFromConfirmation = useCallback(async (block: DetectedBlock, fileName?: string) => {
    if (!user) return;

    const chars: ParserPattern["characteristics"] = {
      columns: block.columnsDetected.slice(0, 20),
      hasNumericData: block.hasNumericData,
      hasPeriodColumns: block.hasPeriodColumns,
      hasCurrencyData: block.hasCurrencyData,
      columnCount: block.columnCount,
    };

    // Check for an existing similar pattern with same type
    const existing = patterns.find(p => {
      if (p.block_type !== block.type) return false;
      const sim = computeSimilarity(block.columnsDetected, p.sample_columns, block, p.characteristics);
      return sim > 0.7;
    });

    if (existing) {
      // Boost confidence
      const newConf = Math.min(1, existing.confidence + 0.05);
      await supabase
        .from("parser_patterns")
        .update({
          confidence: newConf,
          times_confirmed: existing.times_confirmed + 1,
          characteristics: chars as any,
        })
        .eq("id", existing.id);

      setPatterns(prev => prev.map(p =>
        p.id === existing.id
          ? { ...p, confidence: newConf, times_confirmed: p.times_confirmed + 1, characteristics: chars }
          : p
      ));
    } else {
      // Create new pattern
      const { data } = await supabase
        .from("parser_patterns")
        .insert({
          user_id: user.id,
          pattern_name: block.title || `${block.type} bloco`,
          block_type: block.type,
          characteristics: chars as any,
          sample_columns: block.columnsDetected.slice(0, 20),
          confidence: 0.6,
          source_file_name: fileName || null,
        } as any)
        .select()
        .single();

      if (data) {
        setPatterns(prev => [...prev, {
          ...data,
          characteristics: chars,
        }]);
      }
    }
  }, [user, patterns]);

  // Handle user correction (changed type)
  const learnFromCorrection = useCallback(async (
    block: DetectedBlock,
    originalType: BlockType,
    newType: BlockType,
    fileName?: string,
  ) => {
    if (!user) return;

    // Penalize old pattern
    const oldPattern = patterns.find(p => {
      if (p.block_type !== originalType) return false;
      const sim = computeSimilarity(block.columnsDetected, p.sample_columns, block, p.characteristics);
      return sim > 0.6;
    });

    if (oldPattern) {
      const newConf = Math.max(0.1, oldPattern.confidence - 0.1);
      await supabase
        .from("parser_patterns")
        .update({
          confidence: newConf,
          times_corrected: oldPattern.times_corrected + 1,
        })
        .eq("id", oldPattern.id);

      setPatterns(prev => prev.map(p =>
        p.id === oldPattern.id
          ? { ...p, confidence: newConf, times_corrected: p.times_corrected + 1 }
          : p
      ));
    }

    // Create/boost correct pattern
    const correctedBlock = { ...block, type: newType };
    await learnFromConfirmation(correctedBlock, fileName);
  }, [user, patterns, learnFromConfirmation]);

  // Stats
  const autoMatchRate = patterns.length > 0
    ? Math.round(
        patterns.reduce((sum, p) => sum + p.confidence * p.times_confirmed, 0) /
        Math.max(patterns.reduce((sum, p) => sum + p.times_confirmed + p.times_corrected, 0), 1) * 100
      )
    : 0;

  return {
    patterns,
    loading,
    applyMemory,
    matchBlock,
    learnFromConfirmation,
    learnFromCorrection,
    autoMatchRate,
    patternCount: patterns.length,
    loadPatterns,
  };
}
