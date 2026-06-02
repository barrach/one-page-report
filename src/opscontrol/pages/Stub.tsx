import { Construction } from 'lucide-react';

export default function Stub({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <div className="bg-card border rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Esta seção faz parte do OpsControl e será implementada em breve.
        </p>
      </div>
    </div>
  );
}
