import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pause, Play, Repeat, Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/src/design/ThemeProvider';
import { timerElapsedMinutes, timerIsPaused } from '@/src/models/timers';
import type { ActiveTimer } from '@/src/models/types';

const SIZE = 72;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const KIND_LABEL: Record<ActiveTimer['kind'], string> = {
  feed_breast: 'Breastfeeding',
  sleep: 'Sleep',
  tummy_time: 'Tummy time',
  pump: 'Pumping',
};

export interface LiveTimerActions {
  onPause?: () => void;
  onResume?: () => void;
  onSwitchSide?: (side: 'left' | 'right') => void;
  onFinish?: () => void;
}

export function LiveTimerBadge({
  timer,
  actions,
}: {
  timer: ActiveTimer;
  actions?: LiveTimerActions;
}) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const paused = timerIsPaused(timer);
  const elapsed = timerElapsedMinutes(timer, now);
  const minutes = Math.floor(elapsed);
  const seconds = Math.floor((elapsed - minutes) * 60);
  const progress = (elapsed % 60) / 60;

  const isBreast = timer.kind === 'feed_breast';
  const otherSide = timer.side === 'left' ? 'right' : 'left';

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <View style={styles.svgWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.hairline} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={paused ? t.inkFaint : t.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE * progress} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={[styles.time, { color: t.ink }]}>
          {minutes}:{String(seconds).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.kind, { color: t.inkMuted }]}>
          {KIND_LABEL[timer.kind]}
          {isBreast && timer.side ? ` · ${timer.side}` : ''}
          {paused ? ' · paused' : ''}
        </Text>
        <Text style={[styles.total, { color: t.ink }]}>{formatDurationSafe(elapsed)}</Text>
        {isBreast && actions?.onSwitchSide && timer.side && (
          <Text
            style={[styles.link, { color: t.cinnamon }]}
            onPress={() => actions.onSwitchSide?.(otherSide)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${otherSide} side`}
          >
            Switch to {otherSide}
          </Text>
        )}
      </View>
      <View style={styles.btnCol}>
        {paused ? (
          actions?.onResume && (
            <IconBtn color={t.accent} onPress={actions.onResume} label="Resume timer">
              <Play size={18} color={t.accentInk} strokeWidth={2} />
            </IconBtn>
          )
        ) : (
          actions?.onPause && (
            <IconBtn color={t.accent} onPress={actions.onPause} label="Pause timer">
              <Pause size={18} color={t.accentInk} strokeWidth={2} />
            </IconBtn>
          )
        )}
        {actions?.onFinish && (
          <IconBtn color={t.cinnamon} onPress={actions.onFinish} label="Stop and save timer">
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
          </IconBtn>
        )}
      </View>
    </View>
  );
}

function IconBtn({
  children, onPress, label, color,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  color: string;
}) {
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconBtn, { backgroundColor: color }]}
    >
      <Text onPress={onPress} style={styles.iconBtnInner}>
        {children}
      </Text>
    </View>
  );
}

function formatDurationSafe(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 14,
  },
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
  },
  time: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  textWrap: {
    flex: 1,
  },
  kind: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  total: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  link: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 32,
  },
  btnCol: {
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
