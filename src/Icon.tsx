import type { CSSProperties } from 'react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  House, PhoneCall, ForkKnife, Heart, Target, Brain, Barbell, UsersThree, RocketLaunch,
  ClipboardText, Receipt, Palette, Flask, Lightbulb, Microphone, Code, CalendarBlank,
  ChartLineUp, VideoCamera, Lightning, GearSix, TerminalWindow, Sparkle, List, Plus,
  CaretRight, ArrowLeft, PencilSimple, CircleDashed, X, ArrowUp, Bell, CaretDown, Flame,
  AddressBook, Clock, Barcode, Drop, Star, Wallet, Megaphone, Lock, Scales,
} from '@phosphor-icons/react';

const ICONS: Record<string, PhosphorIcon> = {
  house: House,
  'phone-call': PhoneCall,
  'fork-knife': ForkKnife,
  heart: Heart,
  target: Target,
  brain: Brain,
  barbell: Barbell,
  'users-three': UsersThree,
  'rocket-launch': RocketLaunch,
  'clipboard-text': ClipboardText,
  receipt: Receipt,
  palette: Palette,
  flask: Flask,
  lightbulb: Lightbulb,
  microphone: Microphone,
  code: Code,
  'calendar-blank': CalendarBlank,
  'chart-line-up': ChartLineUp,
  'video-camera': VideoCamera,
  lightning: Lightning,
  'gear-six': GearSix,
  'terminal-window': TerminalWindow,
  sparkle: Sparkle,
  list: List,
  plus: Plus,
  'caret-right': CaretRight,
  'arrow-left': ArrowLeft,
  'pencil-simple': PencilSimple,
  'circle-dashed': CircleDashed,
  x: X,
  'arrow-up': ArrowUp,
  bell: Bell,
  'caret-down': CaretDown,
  flame: Flame,
  'address-book': AddressBook,
  clock: Clock,
  barcode: Barcode,
  drop: Drop,
  star: Star,
  wallet: Wallet,
  megaphone: Megaphone,
  lock: Lock,
  scales: Scales,
};

interface Props {
  name: string;
  size?: number | string;
  color?: string;
  style?: CSSProperties;
}

/** Renders a phosphor icon given a `ph-<name>` (or bare `<name>`) id, matching
 *  the id scheme the original design used for its icon-font classes. */
export default function Icon({ name, size, color, style }: Props) {
  const key = name.replace(/^ph-/, '');
  const Cmp = ICONS[key];
  if (!Cmp) return null;
  return <Cmp size={size} weight="regular" color={color} style={style} />;
}
