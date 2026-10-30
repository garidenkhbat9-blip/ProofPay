"use client";
import {
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-validation";
import { Icon } from "./ui";

export function PasswordField({
  newPassword,
  label = "Password",
  error,
  disabled,
  onChange,
  onBlur,
}: {
  newPassword: boolean;
  label?: string;
  error?: string;
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [length, setLength] = useState(0);
  const meetsLength = length >= MIN_PASSWORD_LENGTH;
  function checkCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }
  return (
    <div className="authfield">
      <label className="formlabel" htmlFor="password">
        {label}
      </label>
      <div className="passwordcontrol">
        <input
          className="field"
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          autoCapitalize="none"
          spellCheck={false}
          minLength={newPassword ? MIN_PASSWORD_LENGTH : undefined}
          required
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby="password-help password-caps"
          onChange={(event) => {
            setLength(event.currentTarget.value.length);
            onChange(event);
          }}
          onKeyDown={checkCapsLock}
          onKeyUp={checkCapsLock}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur(event);
          }}
        />
        <button
          type="button"
          className="passwordtoggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-controls="password"
          title={visible ? "Hide password" : "Show password"}
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eye-off" : "eye"} />
        </button>
      </div>
      <p
        id="password-help"
        className={`authhint ${error ? "is-error" : newPassword && meetsLength ? "is-success" : ""}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {error ||
          (newPassword
            ? meetsLength
              ? "Minimum length met."
              : "Use at least 8 characters."
            : "Enter the password for your account.")}
      </p>
      <p id="password-caps" className="authhint capswarning" role="status">
        {capsLock ? "Caps Lock is on." : ""}
      </p>
    </div>
  );
}
