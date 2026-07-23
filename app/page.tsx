import data from "../data/weekly_snapshots.json";
import Dashboard from "./Dashboard";

export default function Home() {
  return <Dashboard data={data} />;
}
