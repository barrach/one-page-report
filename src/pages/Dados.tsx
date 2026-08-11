import DataInputPage from '@/pages/DataInput';
import ProjectSelector from '@/components/ProjectSelector';
import AppSidebar from '@/components/AppSidebar';

const DadosPage = () => {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 min-w-0">
        <div className="bg-card border-b border-border px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sticky top-0 z-50">
          <ProjectSelector showDelete />
        </div>
        <DataInputPage />
      </div>
    </div>
  );
};

export default DadosPage;
