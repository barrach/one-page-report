import { Link } from 'react-router-dom';
import DataInputPage from '@/pages/DataInput';
import ProjectSelector from '@/components/ProjectSelector';
import { FileText, Database } from 'lucide-react';

const DadosPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary px-3 sm:px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 z-50 card-shadow-elevated">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <div className="h-6 w-1 bg-primary-foreground/60 rounded-full" />
            <h1 className="text-sm font-bold text-primary-foreground tracking-[0.15em] uppercase">MEGASTEAM</h1>
          </div>
          <nav className="flex gap-1">
            <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors">
              <FileText className="h-3.5 w-3.5" />
              Relatório
            </Link>
            <Link to="/dados" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/20 text-primary-foreground">
              <Database className="h-3.5 w-3.5" />
              Dados
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ProjectSelector showCreate />
        </div>
      </div>
      <DataInputPage />
    </div>
  );
};

export default DadosPage;
