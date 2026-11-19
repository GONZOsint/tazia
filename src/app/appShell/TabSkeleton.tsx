import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { DUR, EASE } from '../../motion/tokens';

export function TabSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.micro, ease: EASE.outExpo }}
      className="mx-auto flex max-w-[1280px] items-center justify-center px-4 py-16"
    >
      <Loader2 className="h-6 w-6 animate-spin text-faint" />
    </motion.div>
  );
}
