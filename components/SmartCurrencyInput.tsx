
import React, { useState, useEffect, useRef } from 'react';
import { InputScale } from '../types';

interface Props {
  value: number;
  onChange: (value: number) => void;
  scale?: InputScale;
  isCurrency?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SmartCurrencyInput: React.FC<Props> = ({ 
  value, 
  onChange, 
  scale = InputScale.ONES, 
  isCurrency = true, 
  placeholder, 
  className,
  disabled = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState<string>('');

  // Scaling Factors
  const scaleFactor = scale === InputScale.MILLIONS ? 1000000 : (scale === InputScale.THOUSANDS ? 1000 : 1);

  // Initialize display value on mount or external prop change
  useEffect(() => {
    if (!isFocused) {
        // If not focused, show the scaled, formatted value
        const displayVal = isCurrency ? value / scaleFactor : value;
        // Don't show 0 if it's just empty/placeholder
        setLocalValue(value === 0 ? '' : formatNumber(displayVal));
    }
  }, [value, scale, isCurrency, isFocused]);

  const formatNumber = (num: number): string => {
    if (isNaN(num)) return '';
    // Use standard locale formatting (e.g. 1,200.50)
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };

  const parseNumber = (str: string): number => {
    // Remove commas
    const cleaned = str.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFocus = () => {
    setIsFocused(true);
    // On focus, show the raw number (scaled) for editing without commas
    // e.g. If value is 500000 and scale is thousands, display 500
    const rawScaled = isCurrency ? value / scaleFactor : value;
    setLocalValue(rawScaled === 0 ? '' : rawScaled.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Commit changes
    const numericVal = parseNumber(localValue);
    
    // Apply Scale Factor back to parent
    // e.g. User typed 500, scale is thousands -> send 500000
    const finalValue = isCurrency ? numericVal * scaleFactor : numericVal;
    
    onChange(finalValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text" // Use text to allow commas
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder || (isFocused ? '' : '0')}
      className={className}
    />
  );
};
