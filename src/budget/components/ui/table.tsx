import * as React from "react";

import { cn } from "@budget/lib/utils";

/**
 * Global compact table primitives — MegaBudget standard.
 *
 * Applies a uniform, dense, "executive spreadsheet" look across every table in
 * the app:
 *  - text-xs body / text-[10px] uppercase headers
 *  - px-2 / py-2 cell padding
 *  - tight row height (h-9 headers, h-auto body)
 *  - hover/selected states preserved
 *  - inline-edit friendly (cells don't clip Inputs/Selects when given
 *    `data-editing="true"` on the row)
 *
 * Per-table overrides via `className` still win (tailwind-merge ensures the
 * caller's classes take precedence).
 */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-xs",
          // Inline-edit safety: when a row is in edit mode, never clip its
          // contents and let inputs/selects fill the cell width.
          "[&_tr[data-editing=true]_td]:!overflow-visible",
          "[&_tr[data-editing=true]_td]:!whitespace-normal",
          "[&_tr[data-editing=true]_td]:!min-w-0",
          "[&_tr[data-editing=true]_td_input]:w-full [&_tr[data-editing=true]_td_input]:min-w-0",
          "[&_tr[data-editing=true]_td_[role=combobox]]:w-full [&_tr[data-editing=true]_td_[role=combobox]]:min-w-0",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t bg-muted/50 font-medium text-xs [&>tr]:last:border-b-0", className)}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-9 px-2 py-2 text-left align-middle font-medium text-muted-foreground",
        "text-[10px] uppercase tracking-wide whitespace-nowrap",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-2 py-1.5 align-middle text-xs",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-xs text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
