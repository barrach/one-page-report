import { useEffect, useRef, useState } from "react";
import { Card } from "@budget/components/ui/card";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Button } from "@budget/components/ui/button";
import { Building2, Upload, Image as ImageIcon, Loader2, Save } from "lucide-react";
import {
  useCompanySettings, useUpsertCompanySettings, useUploadCompanyLogo,
} from "@budget/hooks/useCompanySettings";

const CompanySettingsPanel = () => {
  const { data: company, isLoading } = useCompanySettings();
  const upsert = useUpsertCompanySettings();
  const uploadLogo = useUploadCompanyLogo();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    legal_name: "",
    cnpj: "",
    address: "",
    contact_name: "",
    contact_role: "",
    contact_email: "",
    contact_phone: "",
  });

  useEffect(() => {
    if (company) {
      setForm({
        legal_name: company.legal_name || "",
        cnpj: company.cnpj || "",
        address: company.address || "",
        contact_name: company.contact_name || "",
        contact_role: company.contact_role || "",
        contact_email: company.contact_email || "",
        contact_phone: company.contact_phone || "",
      });
    }
  }, [company?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => upsert.mutate(form);

  const handleLogoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Arquivo grande demais (máx. 2 MB).");
      return;
    }
    uploadLogo.mutate(file);
    e.target.value = "";
  };

  return (
    <Card className="p-6 bg-card border-border space-y-5">
      <div className="flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Dados da Empresa</h3>
          <p className="text-xs text-muted-foreground">
            Usados no cabeçalho da CPU e em outros documentos exportados.
          </p>
        </div>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-4 p-4 border border-border rounded-md bg-muted/20">
        <div className="w-24 h-24 border border-dashed border-border rounded flex items-center justify-center bg-background overflow-hidden">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-foreground mb-1">Logo da empresa</p>
          <p className="text-[10px] text-muted-foreground mb-2">
            PNG ou JPG, fundo branco/transparente, máx. 2 MB. Aparece no canto superior do .xlsx da CPU.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleLogoSelected}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs"
            disabled={uploadLogo.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {uploadLogo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {company?.logo_url ? "Trocar logo" : "Enviar logo"}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label className="text-xs">Razão Social</Label>
          <Input
            value={form.legal_name}
            onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
            placeholder="MEGASTEAM INSTRUMENTAÇÃO E MECÂNICA LTDA"
            disabled={isLoading}
          />
        </div>
        <div>
          <Label className="text-xs">CNPJ</Label>
          <Input
            value={form.cnpj}
            onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            placeholder="00.000.000/0001-00"
          />
        </div>
        <div>
          <Label className="text-xs">Endereço</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Rua, nº — Bairro, Cidade/UF"
          />
        </div>
        <div>
          <Label className="text-xs">Responsável</Label>
          <Input
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Cargo</Label>
          <Input
            value={form.contact_role}
            onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">E-mail</Label>
          <Input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input
            value={form.contact_phone}
            onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
          {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>
    </Card>
  );
};

export default CompanySettingsPanel;
