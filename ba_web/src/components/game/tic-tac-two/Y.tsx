import React from 'react';
import { motion } from 'framer-motion';

const Y: React.FC = () => (
  <motion.div
    className="marker"
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    transition={{ duration: 0.3 }}
  >
    <span className="y">Y</span>
  </motion.div>
);

export default Y;

