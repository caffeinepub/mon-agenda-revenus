import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';

interface FinancialOverviewProps {
  totalDue: bigint;
  totalPaid: bigint;
  totalRdvFaitsMoisCourant: bigint;
}

export default function FinancialOverview({ totalDue, totalPaid, totalRdvFaitsMoisCourant }: FinancialOverviewProps) {
  const formatNumber = (amount: bigint) => {
    return Number(amount).toLocaleString('fr-FR');
  };

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenus du Mois en Cours (Faits et Payés)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatNumber(totalPaid)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Montants perçus pour les rendez-vous effectués
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dus (RDV Faits ; Mois Courant)</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{formatNumber(totalDue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Montants restant à percevoir
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">RDV faits (Payés et Impayés ; Mois Courant)</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatNumber(totalRdvFaitsMoisCourant)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total des montants dus pour les rendez-vous effectués
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
