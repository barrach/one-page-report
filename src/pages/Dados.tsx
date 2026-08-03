import DataInputPage from '@/pages/DataInput';
import ProjectSelector from '@/components/ProjectSelector';
import AppNavbar from '@/components/AppNavbar';
import logo from '@/assets/megasteam-logo.png.asset.json';
import { useCurrentProject } from '@/store/projectStore';

const DadosPage = () => {
  const project = useCurrentProject();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div>
        {project && (
          <div className="px-3 sm:px-5 py-2 text-xs text-muted-foreground border-b border-border">
            Alimentando <strong className="font-semibold text-foreground">{project.name}</strong>
          </div>
        )}

        <DataInputPage />
      </div>
    </div>
  );
};

export default DadosPage;
