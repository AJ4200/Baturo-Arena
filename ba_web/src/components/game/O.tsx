// components/game/O.tsx
import React from "react";
import { motion } from "framer-motion";

const O: React.FC = () => (
  <motion.div
    className="marker"
    initial={{ scale: 0 }} // Initial scale set to 0
    animate={{ scale: 1 }} // Animation to scale up to 1
    transition={{ duration: 0.3 }} // Animation duration
  >
    <span className="o">O</span>
  </motion.div>
);

export default O;
