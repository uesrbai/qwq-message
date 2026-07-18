"use client";

import { useState, type ChangeEvent } from "react";

type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * 受控表单值。React 19 在 server action 返回后会自动重置表单，
 * 非受控输入框会被清空；用它把值存在 state 里，校验报错时不丢用户输入。
 */
export function useFormValues<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);

  function bind(key: keyof T & string) {
    return {
      value: values[key] ?? "",
      onChange: (e: ChangeEvent<FieldEl>) =>
        setValues((v) => ({ ...v, [key]: e.target.value })),
    };
  }

  return { values, setValues, bind };
}
