import { Link } from "react-router-dom";
import { BarChart2, Activity, TrendingUp, HardHat, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const apps = [
  {
    to: "/budget",
    icon: HardHat,
    name: "MegaPricing",
    tagline: "Orçamentação de projetos",
    description:
      "Orçamentação e controle financeiro de projetos com propostas, contratos e biblioteca técnica.",
    color: "from-[hsl(30,70%,25%)] to-[hsl(30,65%,42%)]",
    badge: "Orçamento",
    badgeColor: "bg-white/20 text-white",
    iconBg: "bg-white/15",
  },
  {
    to: "/controladoria",
    icon: TrendingUp,
    name: "Controladoria",
    tagline: "Gestão financeira e orçamentária",
    description:
      "Dashboard financeiro com acompanhamento de receitas, custos, orçamento e indicadores gerenciais.",
    color: "from-[hsl(158,60%,20%)] to-[hsl(158,55%,35%)]",
    badge: "Financeiro",
    badgeColor: "bg-white/20 text-white",
    iconBg: "bg-white/15",
  },
  {
    to: "/prodcontrol",
    icon: Activity,
    name: "ProdControl",
    tagline: "Medição de Produtividade",
    description:
      "Registro e análise de observações de campo com gráficos, exportação e relatórios por IA.",
    color: "from-[hsl(220,70%,30%)] to-[hsl(220,70%,50%)]",
    badge: "Obra",
    badgeColor: "bg-white/20 text-white",
    iconBg: "bg-white/15",
  },
  {
    to: "/opr",
    icon: BarChart2,
    name: "One Page Report",
    tagline: "Acompanhamento de projetos",
    description:
      "Relatório visual em uma página com Curva S, cronograma, KPIs e insights por IA.",
    color: "from-[hsl(216,62%,16%)] to-[hsl(216,62%,28%)]",
    badge: "Projetos",
    badgeColor: "bg-white/20 text-white",
    iconBg: "bg-white/15",
  },
];

export default function HubPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-center py-12 px-4">
        <div className="text-center space-y-2">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-black text-lg">M</span>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-3xl sm:text-4xl font-black text-foreground tracking-tight"
          >
            MegaHub
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-muted-foreground text-sm sm:text-base"
          >
            Selecione o módulo que deseja acessar
          </motion.p>
        </div>
      </header>

      {/* App cards */}
      <main className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">
          {apps.map((app, i) => (
            <motion.div
              key={app.to}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
            >
              <Link
                to={app.to}
                className="group relative flex flex-col h-full rounded-2xl overflow-hidden card-shadow-elevated hover:scale-[1.02] transition-transform duration-200"
              >
                {/* Gradient background */}
                <div className={`bg-gradient-to-br ${app.color} p-6 flex flex-col gap-4`}>
                  {/* Top row */}
                  <div className="flex items-start justify-between">
                    <div className={`${app.iconBg} rounded-xl p-3`}>
                      <app.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${app.badgeColor}`}>
                      {app.badge}
                    </span>
                  </div>

                  {/* Name + tagline */}
                  <div>
                    <h2 className="text-xl font-bold text-white leading-tight">{app.name}</h2>
                    <p className="text-white/70 text-xs mt-0.5 font-medium">{app.tagline}</p>
                  </div>
                </div>

                {/* Description + CTA */}
                <div className="bg-card border border-border border-t-0 rounded-b-2xl p-5 flex flex-col gap-3 flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">{app.description}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:gap-2.5 transition-all">
                    Acessar módulo
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="text-center py-4 text-[11px] text-muted-foreground">
        MegaHub · Plataforma integrada MEGASTEAM
      </footer>
    </div>
  );
}
