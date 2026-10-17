import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/src/design/ThemeProvider';
import { spacing } from '@/src/design/tokens';
import { useApp } from '@/src/state/AppProvider';
import type { CareEvent } from '@/src/models/types';
import { formatClock } from '@/src/models/time';
import { describeEvent } from '@/src/components/EventRibbon';
import { PrimaryButton } from '@/src/components/ui';
import { EventEditSheet } from './EventEditSheet';

const TYPE_LABEL: Record<CareEvent['type'], string> = {
  feed_bottle: 'Bottle feed',
  feed_breast: 'Breastfeed',
  feed_solids: 'Solids',
  diaper: 'Diaper',
  sleep: 'Sleep',
  pump: 'Pump',
  tummy_time: 'Tummy time',
  note: 'Note',
};

export function EventActionsModal({
  event,
  onClose,
}: {
  event: CareEvent | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const { deleteEvent } = useApp();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!event) return;
    Alert.alert(
      'Delete this entry?',
      `${TYPE_LABEL[event.type]} at ${formatClock(event.timestamp)} — ${describeEvent(event)}`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteEvent(event.id);
            if (ok) onClose();
            else setError('Could not delete. Please try again.');
          },
        },
      ]
    );
  };

  if (editing && event) {
    return (
      <EventEditSheet
        event={event}
        onClose={() => {
          setEditing(false);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal visible={event !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {event && (
          <View style={[styles.card, { backgroundColor: t.canvas }]}>
            <Text style={[styles.type, { color: t.cinnamon }]}>{TYPE_LABEL[event.type]}</Text>
            <Text style={[styles.detail, { color: t.ink }]}>{describeEvent(event)}</Text>
            <Text style={[styles.time, { color: t.inkMuted }]}>
              {formatClock(event.timestamp)}
              {event.note ? ` · ${event.note}` : ''}
            </Text>
            {error && <Text style={[styles.error, { color: t.cinnamon }]}>{error}</Text>}
            <View style={styles.actions}>
              <PrimaryButton
                label="Edit"
                variant="secondary"
                onPress={() => setEditing(true)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Delete"
                onPress={confirmDelete}
                style={{ flex: 1, backgroundColor: t.cinnamon }}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(4),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: spacing(4),
  },
  type: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  detail: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing(1),
  },
  time: {
    fontSize: 14,
    marginTop: spacing(1),
  },
  error: {
    fontSize: 13,
    marginTop: spacing(2),
  },
  actions: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
  },
});
