import DataInputPage from '@/pages/DataInput';
import ProjectSelector from '@/components/ProjectSelector';
import AppSidebar from '@/components/AppSidebar';
import logo from '@/assets/megasteam-logo.png.asset.json';

const DadosPage = () => {
  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 min-w-0">
        <div className="gradient-primary px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sticky top-0 z-50 card-shadow-elevated">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="MEGASTEAM" className="h-6 w-auto object-contain sm:hidden" />
            <span className="hidden sm:block text-xs font-semibold text-primary-foreground/70 tracking-widest uppercase">
              Dados
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ProjectSelector showCreate />
          </div>
        </div>
        <DataInputPage />
      </div>
    </div>
  );
};

export default DadosPage;
