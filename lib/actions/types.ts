export interface AuthState {
  status: "idle" | "error" | "totp" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}

export const initialAuthState: AuthState = { status: "idle" };

export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Връща се при успех, за да може клиентът да обнови или пренасочи. */
  redirectTo?: string;
}

export const initialActionState: ActionState = { status: "idle" };
