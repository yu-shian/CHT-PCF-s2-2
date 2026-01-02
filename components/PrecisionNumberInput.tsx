import React, { useState, useEffect, useRef } from 'react';

interface PrecisionNumberInputProps {
    value: number;
    onChange: (val: number) => void;
    placeholder?: string;
    className?: string;
    min?: number;
    max?: number;
    step?: number | string;
}

const PrecisionNumberInput: React.FC<PrecisionNumberInputProps> = ({
    value,
    onChange,
    className = '',
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localStr, setLocalStr] = useState<string>('');

    // Helper to format for display (max 4 decimals, strip trailing zeros)
    const formatDisplay = (val: number) => {
        return parseFloat(val.toFixed(4)).toString();
    };

    // Sync with external value changes (only when not editing)
    useEffect(() => {
        if (!isFocused) {
            // If value is 0 and localStr is empty, we might want to show empty or 0? 
            // Usually inputs might show 0.
            setLocalStr(formatDisplay(value));
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        // On focus, show the raw number (full precision)
        setLocalStr(value.toString());
    };

    const handleBlur = () => {
        setIsFocused(false);
        // On blur, re-format
        setLocalStr(formatDisplay(value));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalStr(val);

        // Only update parent if it's a valid number
        if (val === '' || val === '-') {
            onChange(0); // Or handle empty differently? For now, 0 is safe for calculations.
        } else {
            const num = parseFloat(val);
            if (!isNaN(num)) {
                onChange(num);
            }
        }
    };

    return (
        <input
            {...props}
            type="number"
            value={localStr}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            title={value.toString()} // Tooltip shows full raw value
            className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
            onWheel={(e) => e.currentTarget.blur()} // Prevent wheel scroll change
        />
    );
};

export default PrecisionNumberInput;
