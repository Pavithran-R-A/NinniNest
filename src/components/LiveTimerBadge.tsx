import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/src/design/ThemeProvider';
import { elapsedMinutes, formatDuration } from '@/src/models/time';
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

export function LiveTimerBadge({ timer, onStop }: { timer: ActiveTimer; onStop?: () => void }) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  const spin = new Animated.Value(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const animate = () => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  };
  animate();

  const elapsed = elapsedMinutes(timer.startedAt, now);
  const minutes = Math.floor(elapsed);
  const seconds = Math.floor((elapsed - minutes) * 60);
  const progress = (elapsed % 60) / 60;

  return (
    <View style={[styles.wrap, { backgroundColor: t.surface, borderColor: t.hairline }]}>
      <View style={styles.svgWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={t.hairline} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={t.accent}
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
        <Text style={[styles.kind, { color: t.inkMuted }]}>{KIND_LABEL[timer.kind]}</Text>
        <Text style={[styles.total, { color: t.ink }]}>{formatDuration(elapsed)}</Text>
        {onStop && (
          <Text style={[styles.stop, { color: t.cinnamon }]} onPress={onStop}>
            Stop and save
          </Text>
        )}
      </View>
    </View>
  );
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
  stop: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 32,
  },
});
