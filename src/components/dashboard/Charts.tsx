import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type SlaPoint = {
  day: string;
  sla: number;
};

type TechPoint = {
  name: string;
  chamados: number;
};

type BurndownPoint = {
  day: string;
  ideal: number;
  real: number;
};

type StatusPoint = {
  name: string;
  value: number;
  color: string;
};

const tooltipStyle = {
  background: "oklch(0.20 0.018 265)",
  border: "1px solid oklch(0.30 0.02 265)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.97 0.01 250)",
  padding: "8px 10px",
};

export function SlaChart({ data }: { data: SlaPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="slaG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.20 260)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.72 0.20 260)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
        <XAxis dataKey="day" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="sla" stroke="oklch(0.72 0.20 260)" strokeWidth={2.5} fill="url(#slaG)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TechChart({ data }: { data: TechPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
        <XAxis dataKey="name" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "oklch(0.27 0.03 265 / 0.3)" }} />
        <Bar dataKey="chamados" fill="oklch(0.65 0.22 300)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BurndownChart({ data }: { data: BurndownPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 265 / 0.4)" />
        <XAxis dataKey="day" stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="oklch(0.68 0.025 260)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="ideal" stroke="oklch(0.68 0.025 260)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        <Line type="monotone" dataKey="real" stroke="oklch(0.72 0.18 155)" strokeWidth={2.5} dot={{ r: 3, fill: "oklch(0.72 0.18 155)" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusPie({ data }: { data: StatusPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Tooltip contentStyle={tooltipStyle} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={4} stroke="none">
          {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
