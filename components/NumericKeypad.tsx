// Custom in-app numeric keypad (FLAG-3, D-02) — NOT the OS keyboard. A
// Pressable-built bottom panel so weight/rep entry keeps the 44x44
// one-handed-gym touch target and cleanly supports 2.5 kg-style decimal
// increments the OS numeric keyboard doesn't reliably offer.
//
// Per-keystroke edits update local string state only; the parsed number is
// returned once via `onDone` (mirrors the Phase-1 keypad-vs-SQL anti-pattern
// from lib/exerciseFilter.ts — no per-keystroke writes of any kind here).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

interface NumericKeypadProps {
  visible: boolean;
  label: string;
  initialValue: number;
  allowDecimal?: boolean;
  onDone: (value: number) => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function NumericKeypad({
  visible,
  label,
  initialValue,
  allowDecimal = true,
  onDone,
  onCancel,
}: NumericKeypadProps) {
  const [value, setValue] = useState(String(initialValue));

  useEffect(() => {
    if (visible) {
      setValue(String(initialValue));
    }
  }, [visible, initialValue]);

  if (!visible) {
    return null;
  }

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setValue((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (!allowDecimal || value.includes('.')) {
        return;
      }
      setValue((prev) => (prev.length === 0 ? '0.' : `${prev}.`));
      return;
    }
    setValue((prev) => (prev === '0' ? key : `${prev}${key}`));
  };

  const handleDone = () => {
    const parsed = Number(value);
    onDone(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close keypad"
      />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.valueText}>{value.length > 0 ? value : '0'}</Text>
        </View>
        <View style={styles.grid}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleKey(key)}
              accessibilityRole="button"
              accessibilityLabel={key === '⌫' ? 'Backspace' : key === '.' ? 'Decimal point' : `Digit ${key}`}
              style={styles.key}
            >
              <Text style={styles.keyText}>{key}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={styles.doneButton}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
  valueText: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  key: {
    width: '31%',
    minWidth: 44,
    minHeight: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
  doneButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: '700',
  },
});
