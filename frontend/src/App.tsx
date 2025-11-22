import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import TMAHome from "@/pages/TMAHome";
import { useTMA } from "@/providers/TMAProvider";

export default function App() {
  const { ready } = useTMA();
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">正在初始化 Telegram 应用...</p>
        </div>
      </div>
    );
  }
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TMAHome />} />
        <Route path="/legacy" element={<Home />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}