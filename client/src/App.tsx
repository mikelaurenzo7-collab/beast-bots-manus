import { Toaster } from "sonner";
import Home from "./pages/Home";

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <Home />
    </>
  );
}