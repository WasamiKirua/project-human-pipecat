import { useState, useRef, useEffect } from "react";

interface TerminalDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  disabled?: boolean;
  className?: string;
}

export function TerminalDropdown({ 
  value, 
  onChange, 
  options, 
  disabled = false,
  className = "" 
}: TerminalDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-2 py-1 text-xs bg-input border border-border rounded text-left cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'border-primary' : ''} companion-button`}
      >
        {selectedOption?.label || "Select..."}
      </button>
      
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
        {isOpen ? "▲" : "▼"}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="companion-panel border-primary bg-card/95 backdrop-blur-sm max-h-48 overflow-hidden">
            <div className="overflow-y-auto max-h-48">
              {options.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 text-xs cursor-pointer transition-all whitespace-nowrap
                    ${option.value === value 
                      ? 'bg-primary/20 text-primary' 
                      : 'text-foreground/80 hover:bg-primary/10 hover:text-primary'
                    }`}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}