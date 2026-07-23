import data from "../data/weekly_snapshots.json";
import Dashboard, { type RadarData } from "./Dashboard";

export default function Home() {
  return <Dashboard data={data as RadarData} />;
}
