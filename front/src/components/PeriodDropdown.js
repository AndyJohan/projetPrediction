import { useEffect, useRef, useState } from 'react';

function PeriodDropdown({
  id,
  value,
  options,
  onChange,
  placeholder = 'Choisir',
  disabled = false,
  describedBy,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const menuId = `${id}-menu`;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div className="period-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`period-dropdown-trigger${isOpen ? ' is-open' : ''}`}
        id={id}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="period-dropdown-value">{selectedOption?.label ?? placeholder}</span>
        <span className="period-dropdown-arrow" aria-hidden="true">
          v
        </span>
      </button>

      {isOpen && (
        <div className="period-dropdown-menu" role="listbox" id={menuId} aria-labelledby={id}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`period-dropdown-option${isSelected ? ' is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PeriodDropdown;
