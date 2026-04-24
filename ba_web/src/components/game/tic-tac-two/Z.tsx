import React from 'react';
import { motion } from 'framer-motion';

const Z: React.FC = () => (
  <motion.div
    className="marker"
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ duration: 0.3 }}
  >
    <span className="z">Z</span>
  </motion.div>
);

export default Z;

