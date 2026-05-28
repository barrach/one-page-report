export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budget_previsto: {
        Row: {
          confianca: string | null
          contract_id: string
          created_at: string
          descricao_origem: string | null
          id: string
          linha_pg: string
          mes_ano: string
          origem: string
          updated_at: string
          user_id: string
          valor_previsto: number
        }
        Insert: {
          confianca?: string | null
          contract_id: string
          created_at?: string
          descricao_origem?: string | null
          id?: string
          linha_pg: string
          mes_ano: string
          origem?: string
          updated_at?: string
          user_id: string
          valor_previsto?: number
        }
        Update: {
          confianca?: string | null
          contract_id?: string
          created_at?: string
          descricao_origem?: string | null
          id?: string
          linha_pg?: string
          mes_ano?: string
          origem?: string
          updated_at?: string
          user_id?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_previsto_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_previsto_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_scenarios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_base: boolean
          name: string
          parent_scenario_id: string | null
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_base?: boolean
          name: string
          parent_scenario_id?: string | null
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_base?: boolean
          name?: string
          parent_scenario_id?: string | null
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_scenarios_parent_scenario_id_fkey"
            columns: ["parent_scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "budget_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_stage_states: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          reopened_at: string | null
          scenario_id: string
          stage_key: string
          status: Database["public"]["Enums"]["budget_stage_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          reopened_at?: string | null
          scenario_id: string
          stage_key: string
          status?: Database["public"]["Enums"]["budget_stage_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          reopened_at?: string | null
          scenario_id?: string
          stage_key?: string
          status?: Database["public"]["Enums"]["budget_stage_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_stage_states_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_template_lines: {
        Row: {
          category_code: string | null
          created_at: string
          drg_group: string | null
          id: string
          is_percentage: boolean
          line_code: string
          line_label: string
          notes: string | null
          sort_order: number
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_code?: string | null
          created_at?: string
          drg_group?: string | null
          id?: string
          is_percentage?: boolean
          line_code: string
          line_label: string
          notes?: string | null
          sort_order?: number
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_code?: string | null
          created_at?: string
          drg_group?: string | null
          id?: string
          is_percentage?: boolean
          line_code?: string
          line_label?: string
          notes?: string | null
          sort_order?: number
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_template_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          source: string
          source_project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          source?: string
          source_project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          source?: string
          source_project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string
          id: string
          legal_name: string
          logo_storage_path: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          id?: string
          legal_name?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          id?: string
          legal_name?: string
          logo_storage_path?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      composition_items: {
        Row: {
          composition_id: string
          consumption: number
          created_at: string
          id: string
          library_item_id: string | null
          notes: string | null
          resource_name: string
          resource_type: string
          sort_order: number
          unit: string | null
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          composition_id: string
          consumption?: number
          created_at?: string
          id?: string
          library_item_id?: string | null
          notes?: string | null
          resource_name: string
          resource_type?: string
          sort_order?: number
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          composition_id?: string
          consumption?: number
          created_at?: string
          id?: string
          library_item_id?: string | null
          notes?: string | null
          resource_name?: string
          resource_type?: string
          sort_order?: number
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composition_items_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composition_items_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "technical_library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      compositions: {
        Row: {
          base_unit: string | null
          created_at: string
          description: string | null
          discipline: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_unit?: string | null
          created_at?: string
          description?: string | null
          discipline?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_unit?: string | null
          created_at?: string
          description?: string | null
          discipline?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_results: {
        Row: {
          co_actual: number
          co_diff: number
          co_planned: number
          competence_month: string
          computed_at: string
          created_at: string
          id: string
          mb_actual: number
          mb_diff: number
          mb_planned: number
          ml_actual_pct: number
          ml_diff_pct: number
          ml_planned_pct: number
          project_id: string
          rb_actual: number
          rb_diff: number
          rb_planned: number
          rl_actual: number
          rl_diff: number
          rl_planned: number
          saude: string
          ta_actual: number
          ta_diff: number
          ta_planned: number
          taxa_adm_pct: number
          ti_actual: number
          ti_diff: number
          ti_planned: number
          updated_at: string
          user_id: string
          vl_actual: number
          vl_diff: number
          vl_planned: number
        }
        Insert: {
          co_actual?: number
          co_diff?: number
          co_planned?: number
          competence_month: string
          computed_at?: string
          created_at?: string
          id?: string
          mb_actual?: number
          mb_diff?: number
          mb_planned?: number
          ml_actual_pct?: number
          ml_diff_pct?: number
          ml_planned_pct?: number
          project_id: string
          rb_actual?: number
          rb_diff?: number
          rb_planned?: number
          rl_actual?: number
          rl_diff?: number
          rl_planned?: number
          saude?: string
          ta_actual?: number
          ta_diff?: number
          ta_planned?: number
          taxa_adm_pct?: number
          ti_actual?: number
          ti_diff?: number
          ti_planned?: number
          updated_at?: string
          user_id: string
          vl_actual?: number
          vl_diff?: number
          vl_planned?: number
        }
        Update: {
          co_actual?: number
          co_diff?: number
          co_planned?: number
          competence_month?: string
          computed_at?: string
          created_at?: string
          id?: string
          mb_actual?: number
          mb_diff?: number
          mb_planned?: number
          ml_actual_pct?: number
          ml_diff_pct?: number
          ml_planned_pct?: number
          project_id?: string
          rb_actual?: number
          rb_diff?: number
          rb_planned?: number
          rl_actual?: number
          rl_diff?: number
          rl_planned?: number
          saude?: string
          ta_actual?: number
          ta_diff?: number
          ta_planned?: number
          taxa_adm_pct?: number
          ti_actual?: number
          ti_diff?: number
          ti_planned?: number
          updated_at?: string
          user_id?: string
          vl_actual?: number
          vl_diff?: number
          vl_planned?: number
        }
        Relationships: []
      }
      contract_revenues: {
        Row: {
          competence_month: string
          created_at: string
          id: string
          notes: string | null
          observation: string | null
          pending_balance: number
          project_id: string
          revenue_actual: number
          revenue_planned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          competence_month: string
          created_at?: string
          id?: string
          notes?: string | null
          observation?: string | null
          pending_balance?: number
          project_id: string
          revenue_actual?: number
          revenue_planned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          competence_month?: string
          created_at?: string
          id?: string
          notes?: string | null
          observation?: string | null
          pending_balance?: number
          project_id?: string
          revenue_actual?: number
          revenue_planned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_revenues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contract_revenues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_settings: {
        Row: {
          cofins_pct: number
          created_at: string
          csll_pct: number
          icms_pct: number
          id: string
          inss_fat_pct: number
          iss_pct: number
          notes: string | null
          pet_pct: number
          pis_pct: number
          project_id: string
          taxa_adm_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cofins_pct?: number
          created_at?: string
          csll_pct?: number
          icms_pct?: number
          id?: string
          inss_fat_pct?: number
          iss_pct?: number
          notes?: string | null
          pet_pct?: number
          pis_pct?: number
          project_id: string
          taxa_adm_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cofins_pct?: number
          created_at?: string
          csll_pct?: number
          icms_pct?: number
          id?: string
          inss_fat_pct?: number
          iss_pct?: number
          notes?: string | null
          pet_pct?: number
          pis_pct?: number
          project_id?: string
          taxa_adm_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cost_items: {
        Row: {
          cost_stage_id: string
          created_at: string
          description: string
          formula_label: string | null
          id: string
          incidence_percent: number | null
          library_item_id: string | null
          notes: string | null
          origin: Database["public"]["Enums"]["origin_kind"]
          origin_reference: string | null
          phase_id: string | null
          quantity: number
          scenario_id: string
          scope_component_id: string | null
          scope_item_id: string | null
          unit: string | null
          unit_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_stage_id: string
          created_at?: string
          description: string
          formula_label?: string | null
          id?: string
          incidence_percent?: number | null
          library_item_id?: string | null
          notes?: string | null
          origin?: Database["public"]["Enums"]["origin_kind"]
          origin_reference?: string | null
          phase_id?: string | null
          quantity?: number
          scenario_id: string
          scope_component_id?: string | null
          scope_item_id?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_stage_id?: string
          created_at?: string
          description?: string
          formula_label?: string | null
          id?: string
          incidence_percent?: number | null
          library_item_id?: string | null
          notes?: string | null
          origin?: Database["public"]["Enums"]["origin_kind"]
          origin_reference?: string | null
          phase_id?: string | null
          quantity?: number
          scenario_id?: string
          scope_component_id?: string | null
          scope_item_id?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_items_cost_stage_id_fkey"
            columns: ["cost_stage_id"]
            isOneToOne: false
            referencedRelation: "cost_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_items_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "technical_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "scenario_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_items_scope_component_id_fkey"
            columns: ["scope_component_id"]
            isOneToOne: false
            referencedRelation: "scope_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_items_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "scope_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_stages: {
        Row: {
          cost_class: string
          created_at: string
          id: string
          label: string
          scenario_id: string
          sort_order: number
          stage_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_class: string
          created_at?: string
          id?: string
          label: string
          scenario_id: string
          sort_order?: number
          stage_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_class?: string
          created_at?: string
          id?: string
          label?: string
          scenario_id?: string
          sort_order?: number
          stage_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_stages_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cpu_client_templates: {
        Row: {
          client_name: string
          col_descricao: string | null
          col_numero: string | null
          col_quantidade: string | null
          col_unidade: string | null
          col_valor_total: string | null
          col_valor_unitario: string | null
          created_at: string
          description: string | null
          header_mappings: Json
          id: string
          is_active: boolean
          notes: string | null
          original_file_name: string
          sheet_name: string | null
          start_row: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name: string
          col_descricao?: string | null
          col_numero?: string | null
          col_quantidade?: string | null
          col_unidade?: string | null
          col_valor_total?: string | null
          col_valor_unitario?: string | null
          created_at?: string
          description?: string | null
          header_mappings?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          original_file_name: string
          sheet_name?: string | null
          start_row?: number
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          col_descricao?: string | null
          col_numero?: string | null
          col_quantidade?: string | null
          col_unidade?: string | null
          col_valor_total?: string | null
          col_valor_unitario?: string | null
          created_at?: string
          description?: string | null
          header_mappings?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          original_file_name?: string
          sheet_name?: string | null
          start_row?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cpu_exports: {
        Row: {
          budget_version: number
          client_template_id: string | null
          created_at: string
          exported_by_email: string | null
          file_name: string
          id: string
          items_snapshot: Json
          payload_snapshot: Json | null
          project_id: string
          proposal_number: string | null
          scenario_id: string
          storage_path: string | null
          template_kind: string
          total_value: number
          user_id: string
        }
        Insert: {
          budget_version?: number
          client_template_id?: string | null
          created_at?: string
          exported_by_email?: string | null
          file_name: string
          id?: string
          items_snapshot?: Json
          payload_snapshot?: Json | null
          project_id: string
          proposal_number?: string | null
          scenario_id: string
          storage_path?: string | null
          template_kind?: string
          total_value?: number
          user_id: string
        }
        Update: {
          budget_version?: number
          client_template_id?: string | null
          created_at?: string
          exported_by_email?: string | null
          file_name?: string
          id?: string
          items_snapshot?: Json
          payload_snapshot?: Json | null
          project_id?: string
          proposal_number?: string | null
          scenario_id?: string
          storage_path?: string | null
          template_kind?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cpu_exports_client_template_id_fkey"
            columns: ["client_template_id"]
            isOneToOne: false
            referencedRelation: "cpu_client_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      drg_import_jobs: {
        Row: {
          created_at: string
          current_sheet: string | null
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          file_name: string
          file_size: number
          finished_at: string | null
          id: string
          processed_sheets: number
          progress: number
          project_id: string | null
          reports: Json
          stage: string
          stage_message: string | null
          started_at: string | null
          status: string
          storage_path: string | null
          summary: Json
          total_sheets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_sheet?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          file_name: string
          file_size?: number
          finished_at?: string | null
          id?: string
          processed_sheets?: number
          progress?: number
          project_id?: string | null
          reports?: Json
          stage?: string
          stage_message?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          summary?: Json
          total_sheets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_sheet?: string | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          file_name?: string
          file_size?: number
          finished_at?: string | null
          id?: string
          processed_sheets?: number
          progress?: number
          project_id?: string | null
          reports?: Json
          stage?: string
          stage_message?: string | null
          started_at?: string | null
          status?: string
          storage_path?: string | null
          summary?: Json
          total_sheets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drg_managerial_mapping: {
        Row: {
          c_gerenc: string
          created_at: string
          drg_class: string
          gerenc_description: string | null
          id: string
          is_active: boolean
          linha_pg: string
          notes: string | null
          pg_description: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          c_gerenc: string
          created_at?: string
          drg_class: string
          gerenc_description?: string | null
          id?: string
          is_active?: boolean
          linha_pg: string
          notes?: string | null
          pg_description?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          c_gerenc?: string
          created_at?: string
          drg_class?: string
          gerenc_description?: string | null
          id?: string
          is_active?: boolean
          linha_pg?: string
          notes?: string | null
          pg_description?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      executive_budget_revisions: {
        Row: {
          author_email: string | null
          change_summary: string | null
          created_at: string
          executive_budget_id: string
          id: string
          new_content: string | null
          previous_content: string | null
          user_id: string
        }
        Insert: {
          author_email?: string | null
          change_summary?: string | null
          created_at?: string
          executive_budget_id: string
          id?: string
          new_content?: string | null
          previous_content?: string | null
          user_id: string
        }
        Update: {
          author_email?: string | null
          change_summary?: string | null
          created_at?: string
          executive_budget_id?: string
          id?: string
          new_content?: string | null
          previous_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_budget_revisions_executive_budget_id_fkey"
            columns: ["executive_budget_id"]
            isOneToOne: false
            referencedRelation: "executive_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          complementary_notes: string | null
          completed_at: string | null
          created_at: string
          document_number: string
          execution_started_at: string | null
          id: string
          is_simulation: boolean
          parent_executive_id: string | null
          project_id: string
          scenario_id: string
          snapshot_data: Json
          status: Database["public"]["Enums"]["executive_budget_status"]
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          complementary_notes?: string | null
          completed_at?: string | null
          created_at?: string
          document_number: string
          execution_started_at?: string | null
          id?: string
          is_simulation?: boolean
          parent_executive_id?: string | null
          project_id: string
          scenario_id: string
          snapshot_data?: Json
          status?: Database["public"]["Enums"]["executive_budget_status"]
          title?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          complementary_notes?: string | null
          completed_at?: string | null
          created_at?: string
          document_number?: string
          execution_started_at?: string | null
          id?: string
          is_simulation?: boolean
          parent_executive_id?: string | null
          project_id?: string
          scenario_id?: string
          snapshot_data?: Json
          status?: Database["public"]["Enums"]["executive_budget_status"]
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_budgets_parent_executive_id_fkey"
            columns: ["parent_executive_id"]
            isOneToOne: false
            referencedRelation: "executive_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_allocations: {
        Row: {
          allocated_value: number
          allocation_percent: number
          allocation_rule: string | null
          competence_date: string
          created_at: string
          entry_id: string
          id: string
          notes: string | null
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allocated_value?: number
          allocation_percent?: number
          allocation_rule?: string | null
          competence_date: string
          created_at?: string
          entry_id: string
          id?: string
          notes?: string | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allocated_value?: number
          allocation_percent?: number
          allocation_rule?: string | null
          competence_date?: string
          created_at?: string
          entry_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_allocations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_apportionments: {
        Row: {
          apportioned_value: number
          apportionment_percent: number
          category_id: string | null
          competence_month: string
          created_at: string
          id: string
          notes: string | null
          rule_name: string | null
          rule_type: string
          source_entry_id: string | null
          source_project_id: string | null
          target_project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apportioned_value?: number
          apportionment_percent?: number
          category_id?: string | null
          competence_month: string
          created_at?: string
          id?: string
          notes?: string | null
          rule_name?: string | null
          rule_type?: string
          source_entry_id?: string | null
          source_project_id?: string | null
          target_project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apportioned_value?: number
          apportionment_percent?: number
          category_id?: string | null
          competence_month?: string
          created_at?: string
          id?: string
          notes?: string | null
          rule_name?: string | null
          rule_type?: string
          source_entry_id?: string | null
          source_project_id?: string | null
          target_project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_apportionments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_apportionments_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_apportionments_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_apportionments_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_apportionments_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_apportionments_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_baselines: {
        Row: {
          approved_at: string
          created_at: string
          expected_duration_days: number | null
          expected_start_date: string | null
          id: string
          monthly_breakdown: Json
          name: string
          project_id: string
          proposal_id: string | null
          scenario_id: string | null
          snapshot_data: Json
          status: string
          total_direct_cost: number
          total_indirect_cost: number
          total_profit: number
          total_revenue: number
          total_taxes: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string
          created_at?: string
          expected_duration_days?: number | null
          expected_start_date?: string | null
          id?: string
          monthly_breakdown?: Json
          name: string
          project_id: string
          proposal_id?: string | null
          scenario_id?: string | null
          snapshot_data?: Json
          status?: string
          total_direct_cost?: number
          total_indirect_cost?: number
          total_profit?: number
          total_revenue?: number
          total_taxes?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string
          created_at?: string
          expected_duration_days?: number | null
          expected_start_date?: string | null
          id?: string
          monthly_breakdown?: Json
          name?: string
          project_id?: string
          proposal_id?: string | null
          scenario_id?: string | null
          snapshot_data?: Json
          status?: string
          total_direct_cost?: number
          total_indirect_cost?: number
          total_profit?: number
          total_revenue?: number
          total_taxes?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_baselines_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_baselines_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          account_type: string | null
          allow_admin: boolean
          allow_operational: boolean
          code: string
          cost_class: string | null
          created_at: string
          drg_group: string | null
          id: string
          is_active: boolean
          is_excluded_default: boolean
          kind: string
          name: string
          parent_code: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          allow_admin?: boolean
          allow_operational?: boolean
          code: string
          cost_class?: string | null
          created_at?: string
          drg_group?: string | null
          id?: string
          is_active?: boolean
          is_excluded_default?: boolean
          kind?: string
          name: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          allow_admin?: boolean
          allow_operational?: boolean
          code?: string
          cost_class?: string | null
          created_at?: string
          drg_group?: string | null
          id?: string
          is_active?: boolean
          is_excluded_default?: boolean
          kind?: string
          name?: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_category_rules: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          mark_as_excluded: boolean
          match_value: string
          priority: number
          rule_type: string
          target_project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mark_as_excluded?: boolean
          match_value: string
          priority?: number
          rule_type: string
          target_project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          mark_as_excluded?: boolean
          match_value?: string
          priority?: number
          rule_type?: string
          target_project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_category_rules_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_category_rules_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_contract_files: {
        Row: {
          competence_month: string | null
          created_at: string
          dedup_hash: string | null
          file_kind: string
          file_name: string
          id: string
          import_id: string | null
          metadata: Json
          notes: string | null
          project_id: string
          row_count: number
          sheet_name: string | null
          status: string
          storage_path: string | null
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          competence_month?: string | null
          created_at?: string
          dedup_hash?: string | null
          file_kind: string
          file_name: string
          id?: string
          import_id?: string | null
          metadata?: Json
          notes?: string | null
          project_id: string
          row_count?: number
          sheet_name?: string | null
          status?: string
          storage_path?: string | null
          total_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          competence_month?: string | null
          created_at?: string
          dedup_hash?: string | null
          file_kind?: string
          file_name?: string
          id?: string
          import_id?: string | null
          metadata?: Json
          notes?: string | null
          project_id?: string
          row_count?: number
          sheet_name?: string | null
          status?: string
          storage_path?: string | null
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_contract_metadata: {
        Row: {
          client_address: string | null
          client_business: string | null
          client_city: string | null
          client_cnpj: string | null
          client_fiscal: string | null
          client_legal_name: string | null
          client_manager: string | null
          client_name: string | null
          contract_duration_days: number | null
          contract_end_date: string | null
          contract_number: string | null
          contract_start_date: string | null
          contract_total_value: number
          contract_type: string | null
          cr_description: string | null
          cr_number: string | null
          created_at: string
          fiscal_period_start: string | null
          id: string
          measurement_modality: string | null
          project_id: string
          raw_data: Json
          responsible: string | null
          responsible_id: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_address?: string | null
          client_business?: string | null
          client_city?: string | null
          client_cnpj?: string | null
          client_fiscal?: string | null
          client_legal_name?: string | null
          client_manager?: string | null
          client_name?: string | null
          contract_duration_days?: number | null
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_total_value?: number
          contract_type?: string | null
          cr_description?: string | null
          cr_number?: string | null
          created_at?: string
          fiscal_period_start?: string | null
          id?: string
          measurement_modality?: string | null
          project_id: string
          raw_data?: Json
          responsible?: string | null
          responsible_id?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_address?: string | null
          client_business?: string | null
          client_city?: string | null
          client_cnpj?: string | null
          client_fiscal?: string | null
          client_legal_name?: string | null
          client_manager?: string | null
          client_name?: string | null
          contract_duration_days?: number | null
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_total_value?: number
          contract_type?: string | null
          cr_description?: string | null
          cr_number?: string | null
          created_at?: string
          fiscal_period_start?: string | null
          id?: string
          measurement_modality?: string | null
          project_id?: string
          raw_data?: Json
          responsible?: string | null
          responsible_id?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_contract_snapshots: {
        Row: {
          accumulated_actual: number
          accumulated_planned: number
          actual_value: number
          competence_month: string
          created_at: string
          id: string
          margin_percent: number
          metadata: Json
          notes: string | null
          planned_value: number
          project_id: string
          source: string
          updated_at: string
          user_id: string
          variance_value: number
        }
        Insert: {
          accumulated_actual?: number
          accumulated_planned?: number
          actual_value?: number
          competence_month: string
          created_at?: string
          id?: string
          margin_percent?: number
          metadata?: Json
          notes?: string | null
          planned_value?: number
          project_id: string
          source?: string
          updated_at?: string
          user_id: string
          variance_value?: number
        }
        Update: {
          accumulated_actual?: number
          accumulated_planned?: number
          actual_value?: number
          competence_month?: string
          created_at?: string
          id?: string
          margin_percent?: number
          metadata?: Json
          notes?: string | null
          planned_value?: number
          project_id?: string
          source?: string
          updated_at?: string
          user_id?: string
          variance_value?: number
        }
        Relationships: []
      }
      financial_cost_centers: {
        Row: {
          client: string | null
          created_at: string
          dept_code: string
          dept_group: string
          dept_name: string
          id: string
          legacy_project_id: string | null
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client?: string | null
          created_at?: string
          dept_code: string
          dept_group?: string
          dept_name: string
          id?: string
          legacy_project_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client?: string | null
          created_at?: string
          dept_code?: string
          dept_group?: string
          dept_name?: string
          id?: string
          legacy_project_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_drg_lines: {
        Row: {
          actual_manual_override: boolean
          actual_value: number
          baseline_id: string | null
          competence_month: string
          created_at: string
          id: string
          is_percentage: boolean
          line_code: string
          line_label: string
          notes: string | null
          planned_manual_override: boolean
          planned_value: number
          project_id: string
          sort_order: number
          source: string
          updated_at: string
          user_id: string
          valor_ajuste_contabil: number
          valor_financeiro: number
          valor_transf_gerencial: number
        }
        Insert: {
          actual_manual_override?: boolean
          actual_value?: number
          baseline_id?: string | null
          competence_month: string
          created_at?: string
          id?: string
          is_percentage?: boolean
          line_code: string
          line_label: string
          notes?: string | null
          planned_manual_override?: boolean
          planned_value?: number
          project_id: string
          sort_order?: number
          source?: string
          updated_at?: string
          user_id: string
          valor_ajuste_contabil?: number
          valor_financeiro?: number
          valor_transf_gerencial?: number
        }
        Update: {
          actual_manual_override?: boolean
          actual_value?: number
          baseline_id?: string | null
          competence_month?: string
          created_at?: string
          id?: string
          is_percentage?: boolean
          line_code?: string
          line_label?: string
          notes?: string | null
          planned_manual_override?: boolean
          planned_value?: number
          project_id?: string
          sort_order?: number
          source?: string
          updated_at?: string
          user_id?: string
          valor_ajuste_contabil?: number
          valor_financeiro?: number
          valor_transf_gerencial?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_drg_lines_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "financial_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_drg_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_drg_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          category_id: string | null
          cnpj: string | null
          competence: string | null
          competence_date: string | null
          contract_project_id: string | null
          cost_center_code: string | null
          cost_center_description: string | null
          cost_value: number
          created_at: string
          dedup_hash: string
          description: string | null
          document: string | null
          due_date: string | null
          duplicate_of: string | null
          entry_number: string | null
          exclusion_reason: string | null
          id: string
          immobilization_months: number | null
          import_id: string | null
          installment_base_value: number | null
          installment_group: string | null
          installment_number: number | null
          installment_total: number | null
          is_duplicate: boolean
          is_excluded: boolean
          is_immobilized: boolean
          issue_date: string | null
          managerial_code: string | null
          mapping_status: string
          paid_value: number
          payment_date: string | null
          pg_drg_class: string | null
          pg_line_code: string | null
          raw_data: Json
          review_notes: string | null
          review_status: string
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          cnpj?: string | null
          competence?: string | null
          competence_date?: string | null
          contract_project_id?: string | null
          cost_center_code?: string | null
          cost_center_description?: string | null
          cost_value?: number
          created_at?: string
          dedup_hash: string
          description?: string | null
          document?: string | null
          due_date?: string | null
          duplicate_of?: string | null
          entry_number?: string | null
          exclusion_reason?: string | null
          id?: string
          immobilization_months?: number | null
          import_id?: string | null
          installment_base_value?: number | null
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_duplicate?: boolean
          is_excluded?: boolean
          is_immobilized?: boolean
          issue_date?: string | null
          managerial_code?: string | null
          mapping_status?: string
          paid_value?: number
          payment_date?: string | null
          pg_drg_class?: string | null
          pg_line_code?: string | null
          raw_data?: Json
          review_notes?: string | null
          review_status?: string
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          cnpj?: string | null
          competence?: string | null
          competence_date?: string | null
          contract_project_id?: string | null
          cost_center_code?: string | null
          cost_center_description?: string | null
          cost_value?: number
          created_at?: string
          dedup_hash?: string
          description?: string | null
          document?: string | null
          due_date?: string | null
          duplicate_of?: string | null
          entry_number?: string | null
          exclusion_reason?: string | null
          id?: string
          immobilization_months?: number | null
          import_id?: string | null
          installment_base_value?: number | null
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_duplicate?: boolean
          is_excluded?: boolean
          is_immobilized?: boolean
          issue_date?: string | null
          managerial_code?: string | null
          mapping_status?: string
          paid_value?: number
          payment_date?: string | null
          pg_drg_class?: string | null
          pg_line_code?: string | null
          raw_data?: Json
          review_notes?: string | null
          review_status?: string
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_entries_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "financial_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_global_settings: {
        Row: {
          cofins_pct: number
          created_at: string
          csll_pct: number
          icms_pct: number
          id: string
          inss_fat_pct: number
          iss_pct: number
          notes: string | null
          pet_pct: number
          pis_pct: number
          taxa_adm_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cofins_pct?: number
          created_at?: string
          csll_pct?: number
          icms_pct?: number
          id?: string
          inss_fat_pct?: number
          iss_pct?: number
          notes?: string | null
          pet_pct?: number
          pis_pct?: number
          taxa_adm_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cofins_pct?: number
          created_at?: string
          csll_pct?: number
          icms_pct?: number
          id?: string
          inss_fat_pct?: number
          iss_pct?: number
          notes?: string | null
          pet_pct?: number
          pis_pct?: number
          taxa_adm_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_imports: {
        Row: {
          competence_month: string | null
          created_at: string
          duplicate_rows: number
          error_message: string | null
          excluded_rows: number
          file_name: string
          id: string
          imported_rows: number
          metadata: Json
          status: string
          storage_path: string | null
          total_rows: number
          total_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          competence_month?: string | null
          created_at?: string
          duplicate_rows?: number
          error_message?: string | null
          excluded_rows?: number
          file_name: string
          id?: string
          imported_rows?: number
          metadata?: Json
          status?: string
          storage_path?: string | null
          total_rows?: number
          total_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          competence_month?: string | null
          created_at?: string
          duplicate_rows?: number
          error_message?: string | null
          excluded_rows?: number
          file_name?: string
          id?: string
          imported_rows?: number
          metadata?: Json
          status?: string
          storage_path?: string | null
          total_rows?: number
          total_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_module_states: {
        Row: {
          competence_month: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          module_key: string
          notes: string | null
          reopened_at: string | null
          scope_project_id: string | null
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          competence_month?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          module_key: string
          notes?: string | null
          reopened_at?: string | null
          scope_project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          competence_month?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          module_key?: string
          notes?: string | null
          reopened_at?: string | null
          scope_project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      financial_planned_entries: {
        Row: {
          baseline_id: string | null
          category_id: string | null
          competence_month: string
          created_at: string
          id: string
          kind: string
          notes: string | null
          planned_value: number
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_id?: string | null
          category_id?: string | null
          competence_month: string
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          planned_value?: number
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_id?: string | null
          category_id?: string | null
          competence_month?: string
          created_at?: string
          id?: string
          kind?: string
          notes?: string | null
          planned_value?: number
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_planned_entries_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "financial_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_planned_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_planned_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_planned_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_revenue_items: {
        Row: {
          baseline_id: string | null
          created_at: string
          description: string
          external_id: string | null
          id: string
          monthly_distribution: Json
          notes: string | null
          parent_item_id: string | null
          project_id: string
          quantity: number
          sort_order: number
          total_value: number
          unit: string | null
          unit_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_id?: string | null
          created_at?: string
          description: string
          external_id?: string | null
          id?: string
          monthly_distribution?: Json
          notes?: string | null
          parent_item_id?: string | null
          project_id: string
          quantity?: number
          sort_order?: number
          total_value?: number
          unit?: string | null
          unit_value?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_id?: string | null
          created_at?: string
          description?: string
          external_id?: string | null
          id?: string
          monthly_distribution?: Json
          notes?: string | null
          parent_item_id?: string | null
          project_id?: string
          quantity?: number
          sort_order?: number
          total_value?: number
          unit?: string | null
          unit_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_revenue_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "financial_revenue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_asset_entries: {
        Row: {
          asset_id: string
          competence_month: string
          conta_pg: string | null
          contract_project_id: string | null
          created_at: string
          entry_date: string
          entry_type: string
          id: string
          installment_index: number | null
          installment_total: number | null
          notes: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          asset_id: string
          competence_month: string
          conta_pg?: string | null
          contract_project_id?: string | null
          created_at?: string
          entry_date: string
          entry_type?: string
          id?: string
          installment_index?: number | null
          installment_total?: number | null
          notes?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          asset_id?: string
          competence_month?: string
          conta_pg?: string | null
          contract_project_id?: string | null
          created_at?: string
          entry_date?: string
          entry_type?: string
          id?: string
          installment_index?: number | null
          installment_total?: number | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          acquisition_date: string
          acquisition_value: number
          amortization_months: number
          conta_pg: string | null
          contract_project_id: string | null
          created_at: string
          depto: string | null
          description: string
          external_item_id: number | null
          id: string
          nf: string | null
          notes: string | null
          quota_mensal: number
          source_entry_id: string | null
          status: string
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acquisition_date?: string
          acquisition_value?: number
          amortization_months?: number
          conta_pg?: string | null
          contract_project_id?: string | null
          created_at?: string
          depto?: string | null
          description: string
          external_item_id?: number | null
          id?: string
          nf?: string | null
          notes?: string | null
          quota_mensal?: number
          source_entry_id?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acquisition_date?: string
          acquisition_value?: number
          amortization_months?: number
          conta_pg?: string | null
          contract_project_id?: string | null
          created_at?: string
          depto?: string | null
          description?: string
          external_item_id?: number | null
          id?: string
          nf?: string | null
          notes?: string | null
          quota_mensal?: number
          source_entry_id?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "fixed_assets_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          detected_kind: Database["public"]["Enums"]["library_kind"] | null
          extracted_fields: Json
          id: string
          is_library_candidate: boolean
          raw_data: Json
          row_number: number
          sheet_id: string
          updated_at: string
          user_id: string
          workbook_id: string
        }
        Insert: {
          created_at?: string
          detected_kind?: Database["public"]["Enums"]["library_kind"] | null
          extracted_fields?: Json
          id?: string
          is_library_candidate?: boolean
          raw_data?: Json
          row_number: number
          sheet_id: string
          updated_at?: string
          user_id: string
          workbook_id: string
        }
        Update: {
          created_at?: string
          detected_kind?: Database["public"]["Enums"]["library_kind"] | null
          extracted_fields?: Json
          id?: string
          is_library_candidate?: boolean
          raw_data?: Json
          row_number?: number
          sheet_id?: string
          updated_at?: string
          user_id?: string
          workbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "import_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "import_workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sheets: {
        Row: {
          column_names: Json
          created_at: string
          detected_kind: Database["public"]["Enums"]["library_kind"] | null
          header_row: number | null
          id: string
          mapping: Json
          metadata: Json
          row_count: number
          sheet_index: number | null
          sheet_name: string
          updated_at: string
          user_id: string
          workbook_id: string
        }
        Insert: {
          column_names?: Json
          created_at?: string
          detected_kind?: Database["public"]["Enums"]["library_kind"] | null
          header_row?: number | null
          id?: string
          mapping?: Json
          metadata?: Json
          row_count?: number
          sheet_index?: number | null
          sheet_name: string
          updated_at?: string
          user_id: string
          workbook_id: string
        }
        Update: {
          column_names?: Json
          created_at?: string
          detected_kind?: Database["public"]["Enums"]["library_kind"] | null
          header_row?: number | null
          id?: string
          mapping?: Json
          metadata?: Json
          row_count?: number
          sheet_index?: number | null
          sheet_name?: string
          updated_at?: string
          user_id?: string
          workbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_sheets_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "import_workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      import_workbooks: {
        Row: {
          created_at: string
          detected_kinds: Database["public"]["Enums"]["library_kind"][]
          error_message: string | null
          file_extension: string | null
          file_name: string
          id: string
          imported_at: string | null
          metadata: Json
          processed_rows: number
          project_id: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          total_sheets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_kinds?: Database["public"]["Enums"]["library_kind"][]
          error_message?: string | null
          file_extension?: string | null
          file_name: string
          id?: string
          imported_at?: string | null
          metadata?: Json
          processed_rows?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_sheets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_kinds?: Database["public"]["Enums"]["library_kind"][]
          error_message?: string | null
          file_extension?: string | null
          file_name?: string
          id?: string
          imported_at?: string | null
          metadata?: Json
          processed_rows?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_sheets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_workbooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "import_workbooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          base_salary: number
          classification: string
          created_at: string
          id: string
          insalub_default: boolean
          is_active: boolean
          is_supervisor: boolean
          notes: string | null
          pericul_default: boolean
          role_code: string
          role_name: string
          sort_order: number
          specialty_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number
          classification?: string
          created_at?: string
          id?: string
          insalub_default?: boolean
          is_active?: boolean
          is_supervisor?: boolean
          notes?: string | null
          pericul_default?: boolean
          role_code: string
          role_name: string
          sort_order?: number
          specialty_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number
          classification?: string
          created_at?: string
          id?: string
          insalub_default?: boolean
          is_active?: boolean
          is_supervisor?: boolean
          notes?: string | null
          pericul_default?: boolean
          role_code?: string
          role_name?: string
          sort_order?: number
          specialty_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          related_collaborator_id: string | null
          related_project_id: string | null
          sender_id: string
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          related_collaborator_id?: string | null
          related_project_id?: string | null
          sender_id: string
          status?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          related_collaborator_id?: string | null
          related_project_id?: string | null
          sender_id?: string
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_collaborator_id_fkey"
            columns: ["related_collaborator_id"]
            isOneToOne: false
            referencedRelation: "project_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      parser_patterns: {
        Row: {
          block_type: string
          characteristics: Json
          confidence: number
          created_at: string
          id: string
          pattern_name: string
          sample_columns: string[]
          source_file_name: string | null
          times_confirmed: number
          times_corrected: number
          updated_at: string
          user_id: string
        }
        Insert: {
          block_type: string
          characteristics?: Json
          confidence?: number
          created_at?: string
          id?: string
          pattern_name: string
          sample_columns?: string[]
          source_file_name?: string | null
          times_confirmed?: number
          times_corrected?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          block_type?: string
          characteristics?: Json
          confidence?: number
          created_at?: string
          id?: string
          pattern_name?: string
          sample_columns?: string[]
          source_file_name?: string | null
          times_confirmed?: number
          times_corrected?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          benefits: number
          charges: number
          competence_month: string
          contract_project_id: string | null
          created_at: string
          gross_payroll: number
          headcount: number
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          benefits?: number
          charges?: number
          competence_month: string
          contract_project_id?: string | null
          created_at?: string
          gross_payroll?: number
          headcount?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          benefits?: number
          charges?: number
          competence_month?: string
          contract_project_id?: string | null
          created_at?: string
          gross_payroll?: number
          headcount?: number
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payroll_entries_contract_project_id_fkey"
            columns: ["contract_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      people_cost_parameters: {
        Row: {
          created_at: string
          desmob_custo_pessoa: number
          epi_kit_inicial_pessoa: number
          epi_mensal_pessoa: number
          epi_override_enabled: boolean
          epi_override_value: number
          hospedagem_diaria: number
          hospedagem_dias_mes: number
          hospedagem_override_enabled: boolean
          hospedagem_override_value: number
          id: string
          mob_custo_pessoa: number
          mob_override_enabled: boolean
          mob_override_value: number
          notes: string | null
          pct_alojados: number
          pct_transferidos: number
          saude_aso_admissional: number
          saude_exames_periodicos: number
          saude_nr_mensal_pessoa: number
          saude_override_enabled: boolean
          saude_override_value: number
          saude_periodicidade_meses: number
          scenario_id: string
          translado_mensal_pessoa: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desmob_custo_pessoa?: number
          epi_kit_inicial_pessoa?: number
          epi_mensal_pessoa?: number
          epi_override_enabled?: boolean
          epi_override_value?: number
          hospedagem_diaria?: number
          hospedagem_dias_mes?: number
          hospedagem_override_enabled?: boolean
          hospedagem_override_value?: number
          id?: string
          mob_custo_pessoa?: number
          mob_override_enabled?: boolean
          mob_override_value?: number
          notes?: string | null
          pct_alojados?: number
          pct_transferidos?: number
          saude_aso_admissional?: number
          saude_exames_periodicos?: number
          saude_nr_mensal_pessoa?: number
          saude_override_enabled?: boolean
          saude_override_value?: number
          saude_periodicidade_meses?: number
          scenario_id: string
          translado_mensal_pessoa?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desmob_custo_pessoa?: number
          epi_kit_inicial_pessoa?: number
          epi_mensal_pessoa?: number
          epi_override_enabled?: boolean
          epi_override_value?: number
          hospedagem_diaria?: number
          hospedagem_dias_mes?: number
          hospedagem_override_enabled?: boolean
          hospedagem_override_value?: number
          id?: string
          mob_custo_pessoa?: number
          mob_override_enabled?: boolean
          mob_override_value?: number
          notes?: string | null
          pct_alojados?: number
          pct_transferidos?: number
          saude_aso_admissional?: number
          saude_exames_periodicos?: number
          saude_nr_mensal_pessoa?: number
          saude_override_enabled?: boolean
          saude_override_value?: number
          saude_periodicidade_meses?: number
          scenario_id?: string
          translado_mensal_pessoa?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      production_factors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          production_factor: number
          sort_order: number
          specialty_code: string
          specialty_label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          production_factor?: number
          sort_order?: number
          specialty_code: string
          specialty_label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          production_factor?: number
          sort_order?: number
          specialty_code?: string
          specialty_label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          project_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          project_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_parameter_defaults: {
        Row: {
          adicional_noturno_pct: number
          almoco_unit: number
          cafe_manha_unit: number
          carga_horaria_diaria: number
          cesta_basica_mensal: number
          convenio_medico_mensal: number
          created_at: string
          data_dissidio: string | null
          dias_trabalhados_semana: number
          encargos_por_ano: Json
          folga_campo_diaria: number
          he_domingo_pct: number
          he_sabado_pct: number
          he_seg_sex_pct: number
          horas_trabalhadas_mes: number
          id: string
          insalubridade_pct: number
          jantar_unit: number
          lanche_unit: number
          notes: string | null
          pct_profissionais_locais: number
          pct_profissionais_transferidos: number
          periculosidade_pct: number
          plr_salarios_ano: number
          preco_acetileno_kg: number
          preco_argonio_m3: number
          preco_co2_m3: number
          preco_eletrodo_carbono_kg: number
          preco_eletrodo_inox_kg: number
          preco_oxigenio_m3: number
          premio_assiduidade_mensal: number
          reajuste_previsto_pct: number
          salario_minimo_regional: number
          sindicato_cct: string | null
          tipo_periodo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adicional_noturno_pct?: number
          almoco_unit?: number
          cafe_manha_unit?: number
          carga_horaria_diaria?: number
          cesta_basica_mensal?: number
          convenio_medico_mensal?: number
          created_at?: string
          data_dissidio?: string | null
          dias_trabalhados_semana?: number
          encargos_por_ano?: Json
          folga_campo_diaria?: number
          he_domingo_pct?: number
          he_sabado_pct?: number
          he_seg_sex_pct?: number
          horas_trabalhadas_mes?: number
          id?: string
          insalubridade_pct?: number
          jantar_unit?: number
          lanche_unit?: number
          notes?: string | null
          pct_profissionais_locais?: number
          pct_profissionais_transferidos?: number
          periculosidade_pct?: number
          plr_salarios_ano?: number
          preco_acetileno_kg?: number
          preco_argonio_m3?: number
          preco_co2_m3?: number
          preco_eletrodo_carbono_kg?: number
          preco_eletrodo_inox_kg?: number
          preco_oxigenio_m3?: number
          premio_assiduidade_mensal?: number
          reajuste_previsto_pct?: number
          salario_minimo_regional?: number
          sindicato_cct?: string | null
          tipo_periodo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adicional_noturno_pct?: number
          almoco_unit?: number
          cafe_manha_unit?: number
          carga_horaria_diaria?: number
          cesta_basica_mensal?: number
          convenio_medico_mensal?: number
          created_at?: string
          data_dissidio?: string | null
          dias_trabalhados_semana?: number
          encargos_por_ano?: Json
          folga_campo_diaria?: number
          he_domingo_pct?: number
          he_sabado_pct?: number
          he_seg_sex_pct?: number
          horas_trabalhadas_mes?: number
          id?: string
          insalubridade_pct?: number
          jantar_unit?: number
          lanche_unit?: number
          notes?: string | null
          pct_profissionais_locais?: number
          pct_profissionais_transferidos?: number
          periculosidade_pct?: number
          plr_salarios_ano?: number
          preco_acetileno_kg?: number
          preco_argonio_m3?: number
          preco_co2_m3?: number
          preco_eletrodo_carbono_kg?: number
          preco_eletrodo_inox_kg?: number
          preco_oxigenio_m3?: number
          premio_assiduidade_mensal?: number
          reajuste_previsto_pct?: number
          salario_minimo_regional?: number
          sindicato_cct?: string | null
          tipo_periodo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_parameters: {
        Row: {
          adicional_noturno_pct: number
          almoco_unit: number
          cafe_manha_unit: number
          carga_horaria_diaria: number
          cesta_basica_mensal: number
          contrato_fim: string | null
          contrato_inicio: string | null
          convenio_medico_mensal: number
          created_at: string
          data_dissidio: string | null
          dias_trabalhados_semana: number
          encargos_por_ano: Json
          folga_campo_diaria: number
          he_domingo_pct: number
          he_sabado_pct: number
          he_seg_sex_pct: number
          horas_trabalhadas_mes: number
          id: string
          insalubridade_pct: number
          jantar_unit: number
          lanche_unit: number
          local_adjustment_defaults: Json
          notes: string | null
          pct_profissionais_locais: number
          pct_profissionais_transferidos: number
          periculosidade_pct: number
          plr_salarios_ano: number
          preco_acetileno_kg: number
          preco_argonio_m3: number
          preco_co2_m3: number
          preco_eletrodo_carbono_kg: number
          preco_eletrodo_inox_kg: number
          preco_oxigenio_m3: number
          premio_assiduidade_mensal: number
          production_factors_override: Json
          project_id: string
          reajuste_previsto_pct: number
          salario_minimo_regional: number
          sindicato_cct: string | null
          tipo_periodo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adicional_noturno_pct?: number
          almoco_unit?: number
          cafe_manha_unit?: number
          carga_horaria_diaria?: number
          cesta_basica_mensal?: number
          contrato_fim?: string | null
          contrato_inicio?: string | null
          convenio_medico_mensal?: number
          created_at?: string
          data_dissidio?: string | null
          dias_trabalhados_semana?: number
          encargos_por_ano?: Json
          folga_campo_diaria?: number
          he_domingo_pct?: number
          he_sabado_pct?: number
          he_seg_sex_pct?: number
          horas_trabalhadas_mes?: number
          id?: string
          insalubridade_pct?: number
          jantar_unit?: number
          lanche_unit?: number
          local_adjustment_defaults?: Json
          notes?: string | null
          pct_profissionais_locais?: number
          pct_profissionais_transferidos?: number
          periculosidade_pct?: number
          plr_salarios_ano?: number
          preco_acetileno_kg?: number
          preco_argonio_m3?: number
          preco_co2_m3?: number
          preco_eletrodo_carbono_kg?: number
          preco_eletrodo_inox_kg?: number
          preco_oxigenio_m3?: number
          premio_assiduidade_mensal?: number
          production_factors_override?: Json
          project_id: string
          reajuste_previsto_pct?: number
          salario_minimo_regional?: number
          sindicato_cct?: string | null
          tipo_periodo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adicional_noturno_pct?: number
          almoco_unit?: number
          cafe_manha_unit?: number
          carga_horaria_diaria?: number
          cesta_basica_mensal?: number
          contrato_fim?: string | null
          contrato_inicio?: string | null
          convenio_medico_mensal?: number
          created_at?: string
          data_dissidio?: string | null
          dias_trabalhados_semana?: number
          encargos_por_ano?: Json
          folga_campo_diaria?: number
          he_domingo_pct?: number
          he_sabado_pct?: number
          he_seg_sex_pct?: number
          horas_trabalhadas_mes?: number
          id?: string
          insalubridade_pct?: number
          jantar_unit?: number
          lanche_unit?: number
          local_adjustment_defaults?: Json
          notes?: string | null
          pct_profissionais_locais?: number
          pct_profissionais_transferidos?: number
          periculosidade_pct?: number
          plr_salarios_ano?: number
          preco_acetileno_kg?: number
          preco_argonio_m3?: number
          preco_co2_m3?: number
          preco_eletrodo_carbono_kg?: number
          preco_eletrodo_inox_kg?: number
          preco_oxigenio_m3?: number
          premio_assiduidade_mensal?: number
          production_factors_override?: Json
          project_id?: string
          reajuste_previsto_pct?: number
          salario_minimo_regional?: number
          sindicato_cct?: string | null
          tipo_periodo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client: string
          contract_type: string | null
          created_at: string
          demobilization_days: number | null
          dept_code: string | null
          dept_group: string | null
          exclusions: string | null
          expected_duration_days: number | null
          id: string
          is_company_entity: boolean
          is_cost_center: boolean
          last_imported_at: string | null
          location: string | null
          mobilization_days: number | null
          notes: string | null
          premises: string | null
          project_name: string
          proposal: string | null
          scope_description: string | null
          start_date: string | null
          status: string | null
          unit: string | null
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          client: string
          contract_type?: string | null
          created_at?: string
          demobilization_days?: number | null
          dept_code?: string | null
          dept_group?: string | null
          exclusions?: string | null
          expected_duration_days?: number | null
          id?: string
          is_company_entity?: boolean
          is_cost_center?: boolean
          last_imported_at?: string | null
          location?: string | null
          mobilization_days?: number | null
          notes?: string | null
          premises?: string | null
          project_name: string
          proposal?: string | null
          scope_description?: string | null
          start_date?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          client?: string
          contract_type?: string | null
          created_at?: string
          demobilization_days?: number | null
          dept_code?: string | null
          dept_group?: string | null
          exclusions?: string | null
          expected_duration_days?: number | null
          id?: string
          is_company_entity?: boolean
          is_cost_center?: boolean
          last_imported_at?: string | null
          location?: string | null
          mobilization_days?: number | null
          notes?: string | null
          premises?: string | null
          project_name?: string
          proposal?: string | null
          scope_description?: string | null
          start_date?: string | null
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client: string
          commercial_notes: string | null
          created_at: string
          direct_cost: number
          exclusions: string | null
          execution_days: number | null
          generated_at: string
          id: string
          indirect_cost: number
          internal_notes: string | null
          location: string | null
          object: string | null
          parent_proposal_id: string | null
          payment_conditions: string | null
          peak_team: number
          premises: string | null
          profit: number
          project_id: string
          proposal_number: string
          responsible: string | null
          revision: number
          sale_price: number
          scenario_id: string | null
          scope_summary: string | null
          signature: string | null
          snapshot_data: Json
          status: string
          tax_notes: string | null
          taxes: number
          total_hh: number
          updated_at: string
          user_id: string
          validity_days: number | null
        }
        Insert: {
          client: string
          commercial_notes?: string | null
          created_at?: string
          direct_cost?: number
          exclusions?: string | null
          execution_days?: number | null
          generated_at?: string
          id?: string
          indirect_cost?: number
          internal_notes?: string | null
          location?: string | null
          object?: string | null
          parent_proposal_id?: string | null
          payment_conditions?: string | null
          peak_team?: number
          premises?: string | null
          profit?: number
          project_id: string
          proposal_number: string
          responsible?: string | null
          revision?: number
          sale_price?: number
          scenario_id?: string | null
          scope_summary?: string | null
          signature?: string | null
          snapshot_data?: Json
          status?: string
          tax_notes?: string | null
          taxes?: number
          total_hh?: number
          updated_at?: string
          user_id: string
          validity_days?: number | null
        }
        Update: {
          client?: string
          commercial_notes?: string | null
          created_at?: string
          direct_cost?: number
          exclusions?: string | null
          execution_days?: number | null
          generated_at?: string
          id?: string
          indirect_cost?: number
          internal_notes?: string | null
          location?: string | null
          object?: string | null
          parent_proposal_id?: string | null
          payment_conditions?: string | null
          peak_team?: number
          premises?: string | null
          profit?: number
          project_id?: string
          proposal_number?: string
          responsible?: string | null
          revision?: number
          sale_price?: number
          scenario_id?: string | null
          scope_summary?: string | null
          signature?: string | null
          snapshot_data?: Json
          status?: string
          tax_notes?: string | null
          taxes?: number
          total_hh?: number
          updated_at?: string
          user_id?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permissions: Json
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: Json
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: Json
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenario_phases: {
        Row: {
          calculated_hh: number
          color_token: string | null
          created_at: string
          duration_days: number
          id: string
          notes: string | null
          phase_name: string
          scenario_id: string
          sort_order: number
          start_day: number
          team_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calculated_hh?: number
          color_token?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          notes?: string | null
          phase_name: string
          scenario_id: string
          sort_order?: number
          start_day?: number
          team_size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calculated_hh?: number
          color_token?: string | null
          created_at?: string
          duration_days?: number
          id?: string
          notes?: string | null
          phase_name?: string
          scenario_id?: string
          sort_order?: number
          start_day?: number
          team_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_phases_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_pricing: {
        Row: {
          bdi_material_admin: number
          bdi_material_insurance: number
          bdi_material_profit: number
          bdi_material_risk: number
          bdi_service_admin: number
          bdi_service_insurance: number
          bdi_service_profit: number
          bdi_service_risk: number
          contingency_pct: number
          created_at: string
          id: string
          monthly_distribution: Json
          reference_label: string | null
          reference_price_per_hh: number
          scenario_id: string
          target_profit_percent: number
          tax_material_cofins: number
          tax_material_cssl: number
          tax_material_ir: number
          tax_material_issqn: number
          tax_material_pis: number
          tax_service_cofins: number
          tax_service_cprb: number
          tax_service_cssl: number
          tax_service_ir: number
          tax_service_issqn: number
          tax_service_outras: number
          tax_service_pis: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bdi_material_admin?: number
          bdi_material_insurance?: number
          bdi_material_profit?: number
          bdi_material_risk?: number
          bdi_service_admin?: number
          bdi_service_insurance?: number
          bdi_service_profit?: number
          bdi_service_risk?: number
          contingency_pct?: number
          created_at?: string
          id?: string
          monthly_distribution?: Json
          reference_label?: string | null
          reference_price_per_hh?: number
          scenario_id: string
          target_profit_percent?: number
          tax_material_cofins?: number
          tax_material_cssl?: number
          tax_material_ir?: number
          tax_material_issqn?: number
          tax_material_pis?: number
          tax_service_cofins?: number
          tax_service_cprb?: number
          tax_service_cssl?: number
          tax_service_ir?: number
          tax_service_issqn?: number
          tax_service_outras?: number
          tax_service_pis?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bdi_material_admin?: number
          bdi_material_insurance?: number
          bdi_material_profit?: number
          bdi_material_risk?: number
          bdi_service_admin?: number
          bdi_service_insurance?: number
          bdi_service_profit?: number
          bdi_service_risk?: number
          contingency_pct?: number
          created_at?: string
          id?: string
          monthly_distribution?: Json
          reference_label?: string | null
          reference_price_per_hh?: number
          scenario_id?: string
          target_profit_percent?: number
          tax_material_cofins?: number
          tax_material_cssl?: number
          tax_material_ir?: number
          tax_material_issqn?: number
          tax_material_pis?: number
          tax_service_cofins?: number
          tax_service_cprb?: number
          tax_service_cssl?: number
          tax_service_ir?: number
          tax_service_issqn?: number
          tax_service_outras?: number
          tax_service_pis?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_pricing_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: true
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_timeline_phases: {
        Row: {
          color_token: string | null
          created_at: string
          duration_weeks: number
          id: string
          phase_name: string
          scenario_id: string
          sort_order: number
          start_week: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color_token?: string | null
          created_at?: string
          duration_weeks?: number
          id?: string
          phase_name: string
          scenario_id: string
          sort_order?: number
          start_week?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color_token?: string | null
          created_at?: string
          duration_weeks?: number
          id?: string
          phase_name?: string
          scenario_id?: string
          sort_order?: number
          start_week?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_timeline_phases_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_workforce: {
        Row: {
          base_salary_override: number | null
          classification: string | null
          created_at: string
          hours_per_month: number
          id: string
          insalub_enabled: boolean
          job_role_id: string | null
          label: string
          parent_code: string | null
          people_count: number
          pericul_enabled: boolean
          period_months: number
          resource_type: string | null
          row_code: string | null
          row_type: string
          scenario_id: string
          sector: string | null
          sort_order: number
          updated_at: string
          user_id: string
          weekly_values: Json
        }
        Insert: {
          base_salary_override?: number | null
          classification?: string | null
          created_at?: string
          hours_per_month?: number
          id?: string
          insalub_enabled?: boolean
          job_role_id?: string | null
          label: string
          parent_code?: string | null
          people_count?: number
          pericul_enabled?: boolean
          period_months?: number
          resource_type?: string | null
          row_code?: string | null
          row_type?: string
          scenario_id: string
          sector?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
          weekly_values?: Json
        }
        Update: {
          base_salary_override?: number | null
          classification?: string | null
          created_at?: string
          hours_per_month?: number
          id?: string
          insalub_enabled?: boolean
          job_role_id?: string | null
          label?: string
          parent_code?: string | null
          people_count?: number
          pericul_enabled?: boolean
          period_months?: number
          resource_type?: string | null
          row_code?: string | null
          row_type?: string
          scenario_id?: string
          sector?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
          weekly_values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_workforce_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_analyses: {
        Row: {
          analysis_data: Json
          analyzed_by: string
          created_at: string
          id: string
          project_context: Json
          project_id: string
          scope_snapshot: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          analysis_data?: Json
          analyzed_by: string
          created_at?: string
          id?: string
          project_context?: Json
          project_id: string
          scope_snapshot?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          analysis_data?: Json
          analyzed_by?: string
          created_at?: string
          id?: string
          project_context?: Json
          project_id?: string
          scope_snapshot?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scope_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "financial_health_by_contract"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scope_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_components: {
        Row: {
          adjusted_hh: number
          calculated_hh: number
          created_at: string
          description: string
          factor_access: number
          factor_climate: number
          factor_complexity: number
          factor_interference: number
          factor_restriction: number
          factor_shift: number
          formula_label: string | null
          hh_total_produtivo: number
          id: string
          library_item_id: string | null
          local_adjustment_override: Json | null
          notes: string | null
          origin: Database["public"]["Enums"]["origin_kind"]
          production_factor: number | null
          productivity_index: number | null
          productivity_unit: string | null
          quantity: number
          resource_type: string | null
          scope_item_id: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjusted_hh?: number
          calculated_hh?: number
          created_at?: string
          description: string
          factor_access?: number
          factor_climate?: number
          factor_complexity?: number
          factor_interference?: number
          factor_restriction?: number
          factor_shift?: number
          formula_label?: string | null
          hh_total_produtivo?: number
          id?: string
          library_item_id?: string | null
          local_adjustment_override?: Json | null
          notes?: string | null
          origin?: Database["public"]["Enums"]["origin_kind"]
          production_factor?: number | null
          productivity_index?: number | null
          productivity_unit?: string | null
          quantity?: number
          resource_type?: string | null
          scope_item_id: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjusted_hh?: number
          calculated_hh?: number
          created_at?: string
          description?: string
          factor_access?: number
          factor_climate?: number
          factor_complexity?: number
          factor_interference?: number
          factor_restriction?: number
          factor_shift?: number
          formula_label?: string | null
          hh_total_produtivo?: number
          id?: string
          library_item_id?: string | null
          local_adjustment_override?: Json | null
          notes?: string | null
          origin?: Database["public"]["Enums"]["origin_kind"]
          production_factor?: number | null
          productivity_index?: number | null
          productivity_unit?: string | null
          quantity?: number
          resource_type?: string | null
          scope_item_id?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_components_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "technical_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_components_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "scope_items"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_items: {
        Row: {
          category: string
          composition_id: string | null
          created_at: string
          description: string | null
          direct_hh_value: number
          discipline: string | null
          entry_mode: string
          id: string
          linked_library_item_id: string | null
          linked_phase_id: string | null
          notes: string | null
          quantity: number
          scenario_id: string
          sort_order: number
          status: string
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          composition_id?: string | null
          created_at?: string
          description?: string | null
          direct_hh_value?: number
          discipline?: string | null
          entry_mode?: string
          id?: string
          linked_library_item_id?: string | null
          linked_phase_id?: string | null
          notes?: string | null
          quantity?: number
          scenario_id: string
          sort_order?: number
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          composition_id?: string | null
          created_at?: string
          description?: string | null
          direct_hh_value?: number
          discipline?: string | null
          entry_mode?: string
          id?: string
          linked_library_item_id?: string | null
          linked_phase_id?: string | null
          notes?: string | null
          quantity?: number
          scenario_id?: string
          sort_order?: number
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_items_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_items_linked_library_item_id_fkey"
            columns: ["linked_library_item_id"]
            isOneToOne: false
            referencedRelation: "technical_library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_items_linked_phase_id_fkey"
            columns: ["linked_phase_id"]
            isOneToOne: false
            referencedRelation: "scenario_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "budget_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_library_items: {
        Row: {
          created_at: string
          discipline: string | null
          group_name: string | null
          id: string
          index_label: string | null
          index_value: number | null
          is_active: boolean
          item_type: string | null
          kind: Database["public"]["Enums"]["library_kind"]
          material: string | null
          notes: string | null
          operation: string | null
          raw_data: Json
          row_id: string | null
          sheet_id: string | null
          source_label: string | null
          source_sheet_name: string | null
          source_workbook_name: string | null
          unit: string | null
          updated_at: string
          user_id: string | null
          workbook_id: string | null
        }
        Insert: {
          created_at?: string
          discipline?: string | null
          group_name?: string | null
          id?: string
          index_label?: string | null
          index_value?: number | null
          is_active?: boolean
          item_type?: string | null
          kind: Database["public"]["Enums"]["library_kind"]
          material?: string | null
          notes?: string | null
          operation?: string | null
          raw_data?: Json
          row_id?: string | null
          sheet_id?: string | null
          source_label?: string | null
          source_sheet_name?: string | null
          source_workbook_name?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          workbook_id?: string | null
        }
        Update: {
          created_at?: string
          discipline?: string | null
          group_name?: string | null
          id?: string
          index_label?: string | null
          index_value?: number | null
          is_active?: boolean
          item_type?: string | null
          kind?: Database["public"]["Enums"]["library_kind"]
          material?: string | null
          notes?: string | null
          operation?: string | null
          raw_data?: Json
          row_id?: string | null
          sheet_id?: string | null
          source_label?: string | null
          source_sheet_name?: string | null
          source_workbook_name?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string | null
          workbook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technical_library_items_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "import_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_library_items_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "import_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_library_items_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "import_workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      financial_health_by_contract: {
        Row: {
          client: string | null
          cost_total: number | null
          dept_code: string | null
          drg_count: number | null
          entry_count: number | null
          last_competence_month: string | null
          project_id: string | null
          project_name: string | null
          snapshot_count: number | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      financial_health_summary: {
        Row: {
          active_contracts: number | null
          categorized: number | null
          drg_lines: number | null
          duplicated: number | null
          excluded: number | null
          linked_to_contract: number | null
          orphan_entries: number | null
          planned_entries: number | null
          snapshots: number | null
          total_cost_value: number | null
          total_entries: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_dashboard_summary: {
        Row: {
          client: string | null
          cost_actual_total: number | null
          cost_planned_total: number | null
          dept_code: string | null
          dept_group: string | null
          project_id: string | null
          project_name: string | null
          revenue_actual_total: number | null
          revenue_planned_total: number | null
          tax_actual_total: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_drg_analytical: {
        Row: {
          actual_value: number | null
          category_code: string | null
          category_id: string | null
          category_name: string | null
          competence_month: string | null
          cost_class: string | null
          drg_group: string | null
          project_id: string | null
          sort_order: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_drg_monthly: {
        Row: {
          actual_value: number | null
          competence_month: string | null
          kind: string | null
          planned_value: number | null
          project_id: string | null
          revenue_actual: number | null
          revenue_planned: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_financial_actuals: {
        Row: {
          category_id: string | null
          category_kind: string | null
          competence_month: string | null
          cost_class: string | null
          drg_group: string | null
          entry_id: string | null
          project_id: string | null
          source: string | null
          user_id: string | null
          value: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_budget_template_to_all_contracts: {
        Args: { _months?: number; _start_month: string; _template_id: string }
        Returns: {
          lines_created: number
          project_id: string
          project_name: string
        }[]
      }
      apply_budget_template_to_contract: {
        Args: {
          _months?: number
          _project_id: string
          _start_month: string
          _template_id: string
        }
        Returns: number
      }
      apply_drg_mapping_to_entries: {
        Args: { _c_gerenc?: string; _user_id: string }
        Returns: {
          updated_rows: number
        }[]
      }
      bulk_upsert_drg_lines: { Args: { _rows: Json }; Returns: number }
      cleanup_admin_fallback_entries: {
        Args: { _user_id?: string }
        Returns: {
          kept: number
          unlinked: number
        }[]
      }
      confirm_financial_module: {
        Args: {
          _competence_month?: string
          _module_key: string
          _notes?: string
          _scope_project_id?: string
        }
        Returns: string
      }
      delete_financial_import: { Args: { _import_id: string }; Returns: Json }
      drg_line_category_filter: {
        Args: { _line_code: string }
        Returns: {
          category_codes: string[]
          cost_classes: string[]
          kinds: string[]
        }[]
      }
      ensure_default_budget_template: {
        Args: { _user_id: string }
        Returns: string
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_collaborator: {
        Args: { _project_id: string; _role?: string }
        Returns: boolean
      }
      manual_sync_budget_acomp: {
        Args: { _project_id: string; _year?: number }
        Returns: {
          lines_actual: number
          lines_planned: number
          months_synced: number
        }[]
      }
      mark_stale_drg_import_jobs: {
        Args: { stale_after_minutes?: number }
        Returns: number
      }
      match_contracts_by_keyword: {
        Args: { _user_id?: string }
        Returns: number
      }
      owns_composition: { Args: { _composition_id: string }; Returns: boolean }
      owns_cost_stage: { Args: { _cost_stage_id: string }; Returns: boolean }
      owns_project: { Args: { _project_id: string }; Returns: boolean }
      owns_scenario: { Args: { _scenario_id: string }; Returns: boolean }
      owns_scope_item: { Args: { _scope_item_id: string }; Returns: boolean }
      owns_sheet: { Args: { _sheet_id: string }; Returns: boolean }
      owns_workbook: { Args: { _workbook_id: string }; Returns: boolean }
      recalc_all_contract_snapshots: {
        Args: { _user_id?: string }
        Returns: number
      }
      recalc_contract_snapshot: {
        Args: {
          _competence_month: string
          _project_id: string
          _user_id: string
        }
        Returns: undefined
      }
      recompute_admin_apportionment: {
        Args: { _competence_month: string; _user_id?: string }
        Returns: {
          out_contracts: number
          out_distributed: number
          out_month: string
          out_pool_total: number
          out_source: string
        }[]
      }
      recompute_all_contract_results: {
        Args: { _year?: number }
        Returns: {
          projects_processed: number
          total_months: number
        }[]
      }
      recompute_contract_results: {
        Args: { _project_id: string; _year?: number }
        Returns: {
          months_processed: number
        }[]
      }
      recompute_contract_results_admin: {
        Args: { _project_id: string; _year?: number }
        Returns: {
          months_processed: number
        }[]
      }
      reconcile_financial_entries: {
        Args: { _user_id?: string }
        Returns: {
          categorized: number
          linked_to_contract: number
          marked_excluded: number
          total_entries: number
        }[]
      }
      reopen_financial_module: {
        Args: {
          _competence_month?: string
          _module_key: string
          _scope_project_id?: string
        }
        Returns: string
      }
      reprocess_financial_entries: {
        Args: { _user_id?: string }
        Returns: {
          admin_unlinked: number
          by_keyword_linked: number
          kept_admin: number
          reconciled_categorized: number
          reconciled_excluded: number
          reconciled_linked: number
          total_entries: number
        }[]
      }
      seed_financial_defaults: {
        Args: { _user_id: string }
        Returns: undefined
      }
      seed_managerial_code_rules: {
        Args: { _user_id: string }
        Returns: number
      }
      seed_managerial_pg_mapping_v2: {
        Args: { _user_id: string }
        Returns: number
      }
      seed_megasteam_cost_centers: {
        Args: { _user_id: string }
        Returns: undefined
      }
      sync_budget_acomp_actual: {
        Args: {
          _competence_month: string
          _project_id: string
          _user_id: string
        }
        Returns: number
      }
      sync_budget_acomp_planned: {
        Args: {
          _competence_month: string
          _project_id: string
          _user_id: string
        }
        Returns: number
      }
      sync_megasteam_cost_centers: {
        Args: { _user_id: string }
        Returns: number
      }
    }
    Enums: {
      budget_stage_status: "draft" | "saved" | "confirmed" | "reopened"
      executive_budget_status:
        | "rascunho"
        | "em_aprovacao"
        | "aprovado"
        | "em_execucao"
        | "concluido"
      import_status: "pending" | "processing" | "ready" | "error"
      library_kind:
        | "productivity"
        | "salary"
        | "charge"
        | "material"
        | "index"
        | "equipment"
        | "risk"
        | "other"
      origin_kind:
        | "library"
        | "manual"
        | "scope"
        | "schedule"
        | "formula"
        | "import"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      budget_stage_status: ["draft", "saved", "confirmed", "reopened"],
      executive_budget_status: [
        "rascunho",
        "em_aprovacao",
        "aprovado",
        "em_execucao",
        "concluido",
      ],
      import_status: ["pending", "processing", "ready", "error"],
      library_kind: [
        "productivity",
        "salary",
        "charge",
        "material",
        "index",
        "equipment",
        "risk",
        "other",
      ],
      origin_kind: [
        "library",
        "manual",
        "scope",
        "schedule",
        "formula",
        "import",
      ],
    },
  },
} as const
