import { useT } from '../../../i18n';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

type LeaveRoomConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LeaveRoomConfirm({ open, onCancel, onConfirm }: LeaveRoomConfirmProps) {
  const t = useT();
  return (
    <ConfirmModal
      open={open}
      title={t('leaveRoomConfirmTitle')}
      body={t('leaveRoomConfirmBody')}
      confirmLabel={t('leaveRoomConfirmAction')}
      danger
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
