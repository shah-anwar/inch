"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordEyeToggleProps {
  id?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PasswordEyeToggle = ({
  id,
  placeholder,
  required,
  value,
  onChange,
}: PasswordEyeToggleProps) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="relative">
        <Input
          className="input"
          id={id}
          placeholder={placeholder}
          type={showPassword ? "text" : "password"}
          required={required}
          value={value}
          onChange={onChange}
        />
        <Button
          className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default PasswordEyeToggle;
