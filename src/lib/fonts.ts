import { Dancing_Script, Caveat, Pacifico } from "next/font/google";

export const dancingScript = Dancing_Script({ subsets: ["latin"], weight: "700" });
export const caveat = Caveat({ subsets: ["latin"], weight: "700" });
export const pacifico = Pacifico({ subsets: ["latin"], weight: "400" });

export const signatureFonts = [
  { id: "dancing-script", label: "Dancing Script", font: dancingScript },
  { id: "caveat", label: "Caveat", font: caveat },
  { id: "pacifico", label: "Pacifico", font: pacifico },
] as const;
