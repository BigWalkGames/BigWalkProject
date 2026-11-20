import { useEffect, useId, useRef, useState } from 'react';
import { KeyCap } from '../../components/KeyCap/KeyCap';
import { playSound } from '../../features/audio/sound';
import { menuMoveSound } from '../../features/audio/menuSounds';
import {
  TIME_ATTACK_LENGTHS,
  setTimeAttackLength,
  useTimeAttackLength,
} from '../../features/typing/timeAttackLength';
import { useHotkeys } from '../../hooks/useHotkeys';

/**
 * The Time Attack length dropdown on the Solo menu (P48): shows the current length,
 * and D or a click opens the list of 15s / 30s / 60s.
 *
 * While open: 1 / 2 / 3 or Up / Down + Enter choose, and Esc, D or a click outside close
 * it. Those keys are caught before the screen's own hotkeys, so Esc closes the list
 * instead of going Back. With it closed, 1 / 2 / 3 are handled by the Solo screen.
 */
export function TimeAttackLengthPicker() {
  const length = useTimeAttackLength();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const openList = () => {
    setActive(Math.max(0, TIME_ATTACK_LENGTHS.indexOf(length)));
    setOpen(true);
  };

  const choose = (index: number) => {
    setTimeAttackLength(TIME_ATTACK_LENGTHS[index]);
    setOpen(false);
    playSound('menuSelect');
  };

  // D opens it (the select click comes from useHotkeys). While open, the listener below handles D.
  useHotkeys({ d: openList }, { enabled: !open });

  // Keys while open: runs in the capture phase on document, before the window hotkeys
  // (Back on Esc, the Solo screen's 1 / 2 / 3), and stops the keys it uses there.
  const chooseRef = useRef(choose);
  const activeRef = useRef(active);
  useEffect(() => {
    chooseRef.current = choose;
    activeRef.current = active;
  });
  useEffect(() => {
    if (!open) return;
    const last = TIME_ATTACK_LENGTHS.length - 1;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const pick = ['1', '2', '3'].indexOf(key);
      let handled = true;

      if (key === 'escape' || key === 'd') {
        if (!event.repeat) {
          setOpen(false);
          playSound('menuBack');
        }
      } else if (key === 'arrowdown' || key === 'arrowup') {
        setActive((index) => (key === 'arrowdown' ? (index === last ? 0 : index + 1) : index === 0 ? last : index - 1));
        playSound('menuMove');
      } else if (key === 'enter' || key === ' ') {
        if (!event.repeat) chooseRef.current(activeRef.current);
      } else if (pick !== -1) {
        if (!event.repeat) chooseRef.current(pick);
      } else {
        handled = false; // Q, H, ... keep working
      }

      if (handled) {
        event.preventDefault(); // also stops Enter / Space from clicking the focused button
        event.stopPropagation();
      }
    };

    // A click anywhere else closes it without changing the length.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="length-picker" ref={rootRef}>
      <button
        type="button"
        className="menu-btn length-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Time Attack length: ${length} seconds`}
        aria-keyshortcuts="D"
        onClick={() => {
          playSound('menuSelect');
          if (open) setOpen(false);
          else openList();
        }}
        {...menuMoveSound}
      >
        <KeyCap label="D" size="sm" />
        <span className="length-picker__value">{length}s</span>
        <span className="length-picker__caret" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul
          id={listId}
          className="length-picker__list"
          role="listbox"
          aria-label="Time Attack length"
          aria-activedescendant={`${listId}-${active}`}
        >
          {TIME_ATTACK_LENGTHS.map((seconds, i) => (
            <li
              key={seconds}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={seconds === length}
              className={`length-picker__option${i === active ? ' is-active' : ''}`}
              onPointerEnter={() => {
                if (i !== active) {
                  setActive(i);
                  playSound('menuMove');
                }
              }}
              onClick={() => choose(i)}
            >
              <KeyCap label={String(i + 1)} size="sm" />
              <span>{seconds}s</span>
              {seconds === length && <span className="length-picker__check" aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
