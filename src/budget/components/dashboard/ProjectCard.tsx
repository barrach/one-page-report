import { Calendar, MapPin, Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface ProjectCardProps {
  id: string;
  name: string;
  client: string;
  location: string;
  startDate: string;
  status: "rascunho" | "em_andamento" | "finalizado";
  totalCost: string;
}

const statusLabels = {
  rascunho: "Rascunho",
  em_andamento: "Em Andamento",
  finalizado: "Finalizado",
};

const statusColors = {
  rascunho: "bg-muted text-muted-foreground",
  em_andamento: "bg-primary/15 text-primary",
  finalizado: "bg-success/15 text-success",
};

const ProjectCard = ({ id, name, client, location, startDate, status, totalCost }: ProjectCardProps) => (
  <div className="glass-card p-5 hover:border-primary/30 transition-all duration-300 group">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {name}
        </h3>
        <p className="text-sm text-muted-foreground">Proposta #{id}</p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[status]}`}>
        {statusLabels[status]}
      </span>
    </div>

    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="w-4 h-4" /> {client}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4" /> {location}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" /> {startDate}
      </div>
    </div>

    <div className="flex items-center justify-between pt-3 border-t border-border">
      <div>
        <p className="text-xs text-muted-foreground">Preço de Venda</p>
        <p className="text-lg font-bold text-accent">{totalCost}</p>
      </div>
      <Link
        to={`/projeto/${id}`}
        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
      >
        Ver detalhes <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </div>
);

export default ProjectCard;
