import {
  createEntityFiles,
  createPageFiles,
  createWidgetFiles,
} from "./basic-slices.mjs";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import {
  dedupeFiles,
  file,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  viewContent,
} from "./shared.mjs";

const ALL_AUTH_MODULES = ["login", "register", "forgot-password"];

/**
 * Builds the file plan for one generated slice in the React family
 * (react-vite and nextjs). This is the React implementation of the shared
 * family generator interface (see family-generators.mjs).
 *
 * @param {string} type - Generator type ("feature", "entity", "widget", "page").
 * @param {string} name - Slice name.
 * @param {object} config - Normalized project config.
 * @returns {object[]} The planned files.
 */
export function createReactFilePlan(type, name, config) {
  if (type === "feature") {
    return name === "auth"
      ? createAuthFeatureFiles(config)
      : createGenericFeatureFiles(name, config);
  }

  if (type === "entity") {
    return createEntityFiles(name);
  }

  if (type === "widget") {
    return createWidgetFiles(name, config);
  }

  return createPageFiles(name, config);
}

function createAuthFeatureFiles(config) {
  const files = [];
  const modules = ALL_AUTH_MODULES;
  const expandedModules = expandAuthModules(modules);

  if (
    config.serverState === "react-query" ||
    config.forms === "react-hook-form-zod"
  ) {
    files.push(...modules.flatMap((module) => authTypeFiles[module] ?? []));
  }

  if (config.serverState === "react-query") {
    files.push(
      ...modules.flatMap((module) => authApiFiles[module] ?? []),
      file("api/auth.query.ts", authQueryContent(modules), true),
      file("lib/auth.keys.ts", authKeysContent(), true),
      file("model/auth.types.ts", authTypesContent(), true)
    );
  }

  if (config.clientState === "zustand") {
    files.push(
      file("model/auth.store.ts", authStoreContent(), true),
      file("model/auth.types.ts", authTypesContent(), true),
      file("lib/auth.helpers.ts", authHelpersContent(), true)
    );
  }

  if (config.clientState === "redux") {
    files.push(
      file("model/auth.slice.ts", authSliceContent(), true),
      file("model/auth.selectors.ts", authSelectorsContent(), true),
      file("model/auth.types.ts", authTypesContent(), true)
    );
  }

  if (
    config.serverState !== "react-query" &&
    !["zustand", "redux"].includes(config.clientState)
  ) {
    files.push(file("model/auth.types.ts", authTypesContent(), true));
  }

  if (config.forms === "react-hook-form-zod") {
    files.push(...modules.flatMap((module) => getAuthSchemaFiles(module)));
  }

  files.push(
    ...expandedModules.map((module) =>
      file(`ui/${module}-form.tsx`, authFormContent(module, config), true)
    )
  );

  return dedupeFiles(files);
}

const authApiFiles = {
  login: [
    file("api/login.api.ts", authApiContent("login", "LoginCredentials", "AuthSession"), false),
  ],
  register: [
    file("api/register.api.ts", authApiContent("register", "RegisterPayload", "AuthSession"), false),
  ],
  "forgot-password": [
    file(
      "api/forgot-password.api.ts",
      authApiContent("forgotPassword", "ForgotPasswordPayload", "ForgotPasswordResult"),
      false
    ),
    file(
      "api/reset-password.api.ts",
      authApiContent("resetPassword", "ResetPasswordPayload", "ResetPasswordResult"),
      false
    ),
    file(
      "api/verify-code.api.ts",
      authApiContent("verifyCode", "VerifyCodePayload", "VerifyCodeResult"),
      false
    ),
  ],
};

const authTypeFiles = {
  login: [file("model/login.types.ts", loginTypesContent(), true)],
  register: [file("model/register.types.ts", registerTypesContent(), true)],
  "forgot-password": [
    file("model/forgot-password.types.ts", forgotPasswordTypesContent(), true),
    file("model/reset-password.types.ts", resetPasswordTypesContent(), true),
    file("model/verify-code.types.ts", verifyCodeTypesContent(), true),
  ],
};

function createGenericFeatureFiles(name, config) {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const files = [
    file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
    file(
      `ui/${name}-view.tsx`,
      viewContent(`${pascalName}View`, `${pascalName} feature`),
      true
    ),
  ];

  if (config.serverState === "react-query") {
    files.push(
      file(`api/${name}.api.ts`, genericApiContent(name, camelName, pascalName), false),
      file(`api/${name}.query.ts`, genericQueryContent(name, camelName, pascalName), true),
      file(`lib/${name}.keys.ts`, keysContent(camelName, name), true)
    );
  }

  if (config.clientState === "zustand") {
    files.push(
      file(`model/${name}.store.ts`, storeContent(camelName, pascalName), true),
      file(`lib/${name}.helpers.ts`, helpersContent(camelName, pascalName), true)
    );
  }

  if (config.clientState === "redux") {
    files.push(
      file(`model/${name}.slice.ts`, sliceContent(camelName, pascalName), true),
      file(`model/${name}.selectors.ts`, selectorsContent(camelName, pascalName), true)
    );
  }

  return files;
}

function expandAuthModules(modules) {
  return modules.flatMap((module) =>
    module === "forgot-password"
      ? ["forgot-password", "reset-password", "verify-code"]
      : [module]
  );
}

function authQueryContent(modules) {
  const imports = [
    'import { useMutation } from "@tanstack/react-query";',
    ...modules.flatMap((module) => authQueryImports[module] ?? []).sort(),
    "",
  ];
  const hooks = modules.flatMap((module) => authQueryHooks[module] ?? []);

  return `${imports.join("\n")}\n${hooks.join("\n\n")}\n`;
}

const authQueryImports = {
  login: ['import { login } from "./login.api";'],
  register: ['import { register } from "./register.api";'],
  "forgot-password": [
    'import { forgotPassword } from "./forgot-password.api";',
    'import { resetPassword } from "./reset-password.api";',
    'import { verifyCode } from "./verify-code.api";',
  ],
};

const authQueryHooks = {
  login: [
    `export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
  });
}`,
  ],
  register: [
    `export function useRegisterMutation() {
  return useMutation({
    mutationFn: register,
  });
}`,
  ],
  "forgot-password": [
    `export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}`,
    `export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}`,
    `export function useVerifyCodeMutation() {
  return useMutation({
    mutationFn: verifyCode,
  });
}`,
  ],
};

function authApiContent(functionName, payloadType, resultType) {
  const payloadFile = modelFileName(payloadType);
  const resultFile = modelFileName(resultType);
  const typeImports =
    payloadFile === resultFile
      ? `import type {\n  ${payloadType},\n  ${resultType},\n} from "../model/${payloadFile}";`
      : [
          `import type { ${payloadType} } from "../model/${payloadFile}";`,
          `import type { ${resultType} } from "../model/${resultFile}";`,
        ]
          .sort()
          .join("\n");

  const endpoint = `/auth/${toKebabCase(functionName)}`;
  const compactRequest = `  const { data } = await apiClient.post<${resultType}>("${endpoint}", payload);`;
  const request =
    compactRequest.length <= 80
      ? compactRequest
      : `  const { data } = await apiClient.post<${resultType}>(
    "${endpoint}",
    payload,
  );`;

  return `import { apiClient } from "@/shared/api";
${typeImports}

export async function ${functionName}(payload: ${payloadType}) {
${request}

  return data;
}
`;
}

function modelFileName(typeName) {
  if (typeName.startsWith("Auth")) return "auth.types";
  if (typeName.startsWith("Login")) return "login.types";
  if (typeName.startsWith("Register")) return "register.types";
  if (typeName.startsWith("Forgot")) return "forgot-password.types";
  if (typeName.startsWith("Reset")) return "reset-password.types";
  return "verify-code.types";
}

function authKeysContent() {
  return `export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};
`;
}

function authTypesContent() {
  return `export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
};
`;
}

function loginTypesContent() {
  return `export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginFormValues = LoginCredentials;
`;
}

function registerTypesContent() {
  return `export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterFormValues = RegisterPayload;
`;
}

function forgotPasswordTypesContent() {
  return `export type ForgotPasswordPayload = {
  email: string;
};

export type ForgotPasswordResult = {
  message: string;
};

export type ForgotPasswordFormValues = ForgotPasswordPayload;
`;
}

function resetPasswordTypesContent() {
  return `export type ResetPasswordPayload = {
  email: string;
  code: string;
  password: string;
  passwordConfirmation: string;
};

export type ResetPasswordResult = {
  message: string;
};

export type ResetPasswordFormValues = ResetPasswordPayload;
`;
}

function verifyCodeTypesContent() {
  return `export type VerifyCodePayload = {
  email: string;
  code: string;
};

export type VerifyCodeResult = {
  isValid: boolean;
};

export type VerifyCodeFormValues = VerifyCodePayload;
`;
}

function authSchemaContent(module) {
  const schemaName = authSchemaNames[module];
  const fields = authSchemaFields[module] ?? [];

  return `import { z } from "zod";

export const ${schemaName} = z.object({
${fields.map((field) => `  ${field}`).join("\n")}
});
`;
}

const authSchemaNames = {
  login: "loginSchema",
  register: "registerSchema",
  "forgot-password": "forgotPasswordSchema",
  "reset-password": "resetPasswordSchema",
  "verify-code": "verifyCodeSchema",
};

const authSchemaFields = {
  login: [
    'email: z.string().email("Enter a valid email address"),',
    'password: z.string().min(8, "Password must contain at least 8 characters"),',
  ],
  register: [
    'name: z.string().min(2, "Name must contain at least 2 characters"),',
    'email: z.string().email("Enter a valid email address"),',
    'password: z.string().min(8, "Password must contain at least 8 characters"),',
  ],
  "forgot-password": ['email: z.string().email("Enter a valid email address"),'],
  "reset-password": [
    'email: z.string().email("Enter a valid email address"),',
    'code: z.string().min(4, "Enter the verification code"),',
    'password: z.string().min(8, "Password must contain at least 8 characters"),',
    'passwordConfirmation: z.string().min(8, "Confirm your password"),',
  ],
  "verify-code": [
    'email: z.string().email("Enter a valid email address"),',
    'code: z.string().min(4, "Enter the verification code"),',
  ],
};

function getAuthSchemaFiles(module) {
  const expandedModules = expandAuthModules([module]);

  return expandedModules.map((name) =>
    file(`model/${name}.schema.ts`, authSchemaContent(name), true)
  );
}

function authStoreContent() {
  return `import { create } from "zustand";
import type { AuthSession, AuthState, AuthUser } from "./auth.types";

type AuthActions = {
  setSession: (session: AuthSession) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,
  setSession: (session) =>
    set({
      user: session.user,
      accessToken: session.accessToken,
      isAuthenticated: true,
    }),
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  logout: () => set(initialState),
}));
`;
}

function authHelpersContent() {
  return `import type { AuthState } from "../model/auth.types";

export function getAuthHeader(state: AuthState) {
  return state.accessToken
    ? { Authorization: \`Bearer \${state.accessToken}\` }
    : {};
}

export function isLoggedIn(state: AuthState) {
  return state.isAuthenticated && Boolean(state.user);
}
`;
}

function authSliceContent() {
  return `import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthSession, AuthState, AuthUser } from "./auth.types";

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<AuthSession>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
    },
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
    },
    logout: () => initialState,
  },
});

export const { setSession, setUser, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;
`;
}

function authSelectorsContent() {
  return `import type { AuthState } from "./auth.types";

type RootState = {
  auth: AuthState;
};

export const selectAuth = (state: RootState) => state.auth;
export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
`;
}

function authFormContent(module, config) {
  if (config.forms === "react-hook-form-zod") {
    return hookFormAuthContent(module, config);
  }

  const componentName = `${toPascalCase(module)}Form`;
  const hookName = authMutationHookNames[module];
  const hookImport =
    config.serverState === "react-query" && hookName
      ? `import { ${hookName} } from "../api/auth.query";\n`
      : "";
  const mutationLine =
    config.serverState === "react-query" && hookName
      ? `  const ${toCamelCase(module)}Mutation = ${hookName}();\n`
      : "";
  const submitHandler =
    config.serverState === "react-query" && hookName
      ? `  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(event);
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    ${toCamelCase(module)}Mutation.mutate(payload as never);
  }\n`
      : `  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(event);
  }\n`;
  const busyProp =
    config.serverState === "react-query" && hookName
      ? `aria-busy={${toCamelCase(module)}Mutation.isPending}`
      : "";
  const disabledProp =
    config.serverState === "react-query" && hookName
      ? `disabled={${toCamelCase(module)}Mutation.isPending}`
      : "";
  const fields = authFormFields[module] ?? [];
  const fieldsMarkup = fields
    .map((field) => {
      const input = `<input name="${field.name}" type="${field.type}" autoComplete="${field.autoComplete}" />`;
      const inputMarkup =
        input.length + 8 <= 80
          ? `        ${input}`
          : `        <input
          name="${field.name}"
          type="${field.type}"
          autoComplete="${field.autoComplete}"
        />`;

      return `      <label>
        ${field.label}
${inputMarkup}
      </label>`;
    })
    .join("\n");
  const buttonMarkup = disabledProp
    ? `      <button type="submit" ${disabledProp}>
        ${authSubmitLabels[module]}
      </button>`
    : `      <button type="submit">${authSubmitLabels[module]}</button>`;
  const formOpening = busyProp
    ? `<form
      onSubmit={handleSubmit}
      className="${module}-form"
      ${busyProp}
    >`
    : `<form onSubmit={handleSubmit} className="${module}-form">`;

  const clientDirective = getFrameworkAdapter(config.framework).clientDirective;

  return `${clientDirective}import type { FormEvent } from "react";
${hookImport}
type ${componentName}Props = {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

export function ${componentName}({ onSubmit }: ${componentName}Props) {
${mutationLine}${submitHandler}
  return (
    ${formOpening}
${fieldsMarkup}
${buttonMarkup}
    </form>
  );
}
`;
}

function hookFormAuthContent(module, config) {
  const componentName = `${toPascalCase(module)}Form`;
  const valuesType = `${toPascalCase(module)}FormValues`;
  const schemaName = authSchemaNames[module];
  const hookName = authMutationHookNames[module];
  const mutationName = `${toCamelCase(module)}Mutation`;
  const hasMutation = config.serverState === "react-query" && hookName;
  const clientDirective = getFrameworkAdapter(config.framework).clientDirective;
  const imports = [
    'import { zodResolver } from "@hookform/resolvers/zod";',
    'import { useForm } from "react-hook-form";',
  ];

  if (hasMutation) {
    imports.push(`import { ${hookName} } from "../api/auth.query";`);
  }
  imports.push(
    `import { ${schemaName} } from "../model/${module}.schema";`,
    `import type { ${valuesType} } from "../model/${module}.types";`
  );

  const fieldsMarkup = (authFormFields[module] ?? [])
    .map((field) => {
      const register = `{...form.register("${field.name}")}`;
      const compactInput = `<input type="${field.type}" autoComplete="${field.autoComplete}" ${register} />`;
      const inputMarkup =
        compactInput.length + 8 <= 80
          ? `        ${compactInput}`
          : `        <input
          type="${field.type}"
          autoComplete="${field.autoComplete}"
          ${register}
        />`;

      return `      <label>
        ${field.label}
${inputMarkup}
      </label>
      {form.formState.errors.${field.name} ? (
        <p role="alert">{form.formState.errors.${field.name}.message}</p>
      ) : null}`;
    })
    .join("\n");
  const mutationSetup = hasMutation ? `  const ${mutationName} = ${hookName}();\n` : "";
  const mutationSubmit = hasMutation ? `\n    ${mutationName}.mutate(values);` : "";
  const formBusy = hasMutation ? ` aria-busy={${mutationName}.isPending}` : "";
  const buttonDisabled = hasMutation ? ` disabled={${mutationName}.isPending}` : "";
  const submitButton = hasMutation
    ? `      <button type="submit"${buttonDisabled}>
        ${authSubmitLabels[module]}
      </button>`
    : `      <button type="submit">${authSubmitLabels[module]}</button>`;

  return `${clientDirective}${imports.join("\n")}

type ${componentName}Props = {
  onSubmit?: (values: ${valuesType}) => void;
};

export function ${componentName}({ onSubmit }: ${componentName}Props) {
${mutationSetup}  const form = useForm<${valuesType}>({
    resolver: zodResolver(${schemaName}),
  });
  const handleSubmit = form.handleSubmit((values) => {
    onSubmit?.(values);${mutationSubmit}
  });

  return (
    <form onSubmit={handleSubmit}${formBusy}>
${fieldsMarkup}
${submitButton}
    </form>
  );
}
`;
}

const authMutationHookNames = {
  login: "useLoginMutation",
  register: "useRegisterMutation",
  "forgot-password": "useForgotPasswordMutation",
  "reset-password": "useResetPasswordMutation",
  "verify-code": "useVerifyCodeMutation",
};

const authFormFields = {
  login: [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Password", name: "password", type: "password", autoComplete: "current-password" },
  ],
  register: [
    { label: "Name", name: "name", type: "text", autoComplete: "name" },
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Password", name: "password", type: "password", autoComplete: "new-password" },
  ],
  "forgot-password": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
  ],
  "reset-password": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Verification code", name: "code", type: "text", autoComplete: "one-time-code" },
    { label: "New password", name: "password", type: "password", autoComplete: "new-password" },
    {
      label: "Confirm password",
      name: "passwordConfirmation",
      type: "password",
      autoComplete: "new-password",
    },
  ],
  "verify-code": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Verification code", name: "code", type: "text", autoComplete: "one-time-code" },
  ],
};

const authSubmitLabels = {
  login: "Log in",
  register: "Create account",
  "forgot-password": "Send reset code",
  "reset-password": "Reset password",
  "verify-code": "Verify code",
};

function genericApiContent(name, camelName, pascalName) {
  return `import { apiClient } from "@/shared/api";
import type { ${pascalName} } from "../model/${name}.types";

export async function get${pascalName}() {
  const { data } = await apiClient.get<${pascalName}>("/${name}");

  return data;
}

export async function update${pascalName}(payload: Partial<${pascalName}>) {
  const { data } = await apiClient.patch<${pascalName}>("/${name}", payload);

  return data;
}

export const ${camelName}Api = {
  get${pascalName},
  update${pascalName},
};
`;
}

function genericQueryContent(name, camelName, pascalName) {
  return `import { useMutation, useQuery } from "@tanstack/react-query";
import { ${camelName}Keys } from "../lib/${name}.keys";
import { get${pascalName}, update${pascalName} } from "./${name}.api";

export function use${pascalName}Query() {
  return useQuery({
    queryKey: ${camelName}Keys.detail(),
    queryFn: get${pascalName},
  });
}

export function useUpdate${pascalName}Mutation() {
  return useMutation({
    mutationFn: update${pascalName},
  });
}
`;
}

function genericTypesContent(pascalName) {
  return `export type ${pascalName} = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ${pascalName}Status = "idle" | "loading" | "success" | "error";
`;
}

function keysContent(camelName, name) {
  return `export const ${camelName}Keys = {
  all: ["${name}"] as const,
  detail: () => [...${camelName}Keys.all, "detail"] as const,
};
`;
}

function storeContent(camelName, pascalName) {
  return `import { create } from "zustand";
import type { ${pascalName}, ${pascalName}Status } from "./${toKebabCase(pascalName)}.types";

type ${pascalName}State = {
  item: ${pascalName} | null;
  status: ${pascalName}Status;
  setItem: (item: ${pascalName} | null) => void;
  setStatus: (status: ${pascalName}Status) => void;
  reset: () => void;
};

const initialState = {
  item: null,
  status: "idle" as ${pascalName}Status,
};

export const use${pascalName}Store = create<${pascalName}State>((set) => ({
  ...initialState,
  setItem: (item) => set({ item }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
`;
}

function helpersContent(camelName, pascalName) {
  return `import type { ${pascalName} } from "../model/${toKebabCase(pascalName)}.types";

export function has${pascalName}(item: ${pascalName} | null): item is ${pascalName} {
  return Boolean(item);
}

export function get${pascalName}Label(item: ${pascalName}) {
  return item.name;
}
`;
}

function sliceContent(camelName, pascalName) {
  return `import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ${pascalName}, ${pascalName}Status } from "./${toKebabCase(pascalName)}.types";

export type ${pascalName}State = {
  item: ${pascalName} | null;
  status: ${pascalName}Status;
};

const initialState: ${pascalName}State = {
  item: null,
  status: "idle",
};

export const ${camelName}Slice = createSlice({
  name: "${camelName}",
  initialState,
  reducers: {
    set${pascalName}: (state, action: PayloadAction<${pascalName} | null>) => {
      state.item = action.payload;
    },
    set${pascalName}Status: (state, action: PayloadAction<${pascalName}Status>) => {
      state.status = action.payload;
    },
    reset${pascalName}: () => initialState,
  },
});

export const { set${pascalName}, set${pascalName}Status, reset${pascalName} } = ${camelName}Slice.actions;
export const ${camelName}Reducer = ${camelName}Slice.reducer;
`;
}

function selectorsContent(camelName, pascalName) {
  return `type RootState = {
  ${camelName}: import("./${toKebabCase(pascalName)}.slice").${pascalName}State;
};

export const select${pascalName}State = (state: RootState) => state.${camelName};
export const select${pascalName} = (state: RootState) => state.${camelName}.item;
export const select${pascalName}Status = (state: RootState) => state.${camelName}.status;
`;
}

/**
 * The React family generator, implementing the shared family generator
 * interface (see family-generators.mjs).
 */
export const reactFamilyGenerator = Object.freeze({
  family: "react",
  createFilePlan: createReactFilePlan,
});
