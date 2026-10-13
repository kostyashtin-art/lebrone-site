import { Navigate, Route, Routes } from "react-router-dom";
import DraftSimulator from "./DraftSimulator";

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<DraftSimulator />} />
    </Routes>
  );
}
