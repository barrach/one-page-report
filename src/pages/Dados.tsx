import DataInputPage from '@/pages/DataInput';
import AppSidebar from '@/components/AppSidebar';

// O seletor de projeto fica na primeira linha da própria página, alinhado com
// o "Importar Semana" — por isso aqui não há mais barra superior.
const DadosPage = () => {
  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar />
      <div className="flex-1 min-w-0">
        <DataInputPage />
      </div>
    </div>
  );
};

export default DadosPage;
