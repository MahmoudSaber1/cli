import {
  file,
  toCamelCase,
  toPascalCase,
  toTitle,
} from "./shared.mjs";
import { isWidgetPreset, svelteWidgetPresetContent } from "./widget-presets.mjs";
import { isPagePreset, sveltePagePresetContent } from "./page-presets.mjs";

const AUTH_FORMS = [
  {
    name: "login",
    component: "LoginForm",
    payload: "LoginCredentials",
    schema: "loginSchema",
    mutation: "createLoginMutation",
    submit: "Log in",
    fields: [
      ["email", "Email", "email", "email"],
      ["password", "Password", "password", "current-password"],
    ],
  },
  {
    name: "register",
    component: "RegisterForm",
    payload: "RegisterPayload",
    schema: "registerSchema",
    mutation: "createRegisterMutation",
    submit: "Create account",
    fields: [
      ["name", "Name", "text", "name"],
      ["email", "Email", "email", "email"],
      ["password", "Password", "password", "new-password"],
    ],
  },
  {
    name: "forgot-password",
    component: "ForgotPasswordForm",
    payload: "ForgotPasswordPayload",
    schema: "forgotPasswordSchema",
    mutation: "createForgotPasswordMutation",
    submit: "Send reset code",
    fields: [["email", "Email", "email", "email"]],
  },
  {
    name: "reset-password",
    component: "ResetPasswordForm",
    payload: "ResetPasswordPayload",
    schema: "resetPasswordSchema",
    mutation: "createResetPasswordMutation",
    submit: "Reset password",
    fields: [
      ["token", "Reset token", "text", "one-time-code"],
      ["password", "New password", "password", "new-password"],
    ],
  },
  {
    name: "verify-code",
    component: "VerifyCodeForm",
    payload: "VerifyCodePayload",
    schema: "verifyCodeSchema",
    mutation: "createVerifyCodeMutation",
    submit: "Verify code",
    fields: [
      ["email", "Email", "email", "email"],
      ["code", "Verification code", "text", "one-time-code"],
    ],
  },
];

export function createSvelteFilePlan(type, name, config) {
  if (type === "feature") {
    return name === "auth"
      ? createSvelteAuthFiles(config)
      : createSvelteFeatureFiles(name, config);
  }
  if (type === "entity") return createSvelteEntityFiles(name);
  if (type === "widget") return createSvelteWidgetFiles(name);
  return createSveltePageFiles(name);
}

function createSvelteFeatureFiles(name, config) {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const files = [
    file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
    svelteComponent(
      `ui/${pascalName}View.svelte`,
      `${pascalName}View`,
      viewContent(`${toTitle(name)} feature`)
    ),
  ];

  if (config.serverState === "svelte-query") {
    files.push(
      file(`api/${name}.api.ts`, genericApiContent(name, pascalName), false),
      file(
        `api/${name}.query.ts`,
        genericQueryContent(name, camelName, pascalName),
        true
      ),
      file(`lib/${name}.keys.ts`, keysContent(camelName, name), true)
    );
  }
  if (config.clientState === "svelte-store") {
    files.push(
      file(
        `model/${name}.store.ts`,
        svelteStoreContent(name, camelName, pascalName),
        true
      )
    );
  }

  return files;
}

function createSvelteEntityFiles(name) {
  const pascalName = toPascalCase(name);
  return [
    file(`model/${name}.types.ts`, entityTypesContent(pascalName), true),
    svelteComponent(
      `ui/${pascalName}Card.svelte`,
      `${pascalName}Card`,
      entityCardContent(name, pascalName)
    ),
  ];
}

function createSvelteWidgetFiles(name) {
  const componentName = toPascalCase(name);
  return [
    svelteComponent(
      `ui/${componentName}.svelte`,
      componentName,
      isWidgetPreset(name)
        ? svelteWidgetPresetContent(name)
        : viewContent(`${toTitle(name)} widget`)
    ),
  ];
}

function createSveltePageFiles(name) {
  const componentName = `${toPascalCase(name)}Page`;
  return [
    svelteComponent(
      `ui/${componentName}.svelte`,
      componentName,
      isPagePreset(name)
        ? sveltePagePresetContent(name)
        : viewContent(`${toTitle(name)} page`)
    ),
  ];
}

function createSvelteAuthFiles(config) {
  const forms = AUTH_FORMS.map(form => config.authProvider === "supabase" && form.name === "reset-password" ? {
    ...form, fields: [
      ["email", "Email", "email", "email"],
      ["code", "Recovery code", "text", "one-time-code"],
      ["password", "New password", "password", "new-password"],
      ["passwordConfirmation", "Confirm password", "password", "new-password"],
    ],
  } : form);
  const files = [file("model/auth.types.ts", authTypesContent(config.authProvider), true)];

  if (config.serverState === "svelte-query") {
    files.push(
      ...forms.map((form) =>
        file(`api/${form.name}.api.ts`, authApiContent(form), false)
      ),
      file("api/auth.query.ts", authQueryContent(), true),
      file("lib/auth.keys.ts", authKeysContent(), true)
    );
  }
  if (config.clientState === "svelte-store") {
    files.push(file("model/auth.store.ts", authStoreContent(), true));
  }
  if (config.forms === "sveltekit-superforms-zod") {
    files.push(
      ...forms.map((form) =>
        file(`model/${form.name}.schema.ts`, authSchemaContent(form), true)
      )
    );
  }
  files.push(
    ...forms.map((form) =>
      svelteComponent(
        `ui/${form.component}.svelte`,
        form.component,
        authFormContent(form, config)
      )
    )
  );

  return files;
}

function svelteComponent(pathname, exportName, content) {
  return {
    ...file(pathname, content, true),
    exportLine: `export { default as ${exportName} } from "./${pathname}";`,
  };
}

function viewContent(title) {
  return `<script lang="ts">
  let { title = "${title}" }: { title?: string } = $props();
</script>

<section>
  <h2>{title}</h2>
</section>
`;
}

function entityCardContent(name, pascalName) {
  const propertyName = toCamelCase(name);
  return `<script lang="ts">
  import type { ${pascalName} } from "../model/${name}.types";

  let { ${propertyName} }: { ${propertyName}: ${pascalName} } = $props();
</script>

<article>
  <h3>{${propertyName}.name}</h3>
  {#if ${propertyName}.description}
    <p>{${propertyName}.description}</p>
  {/if}
</article>
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

function entityTypesContent(pascalName) {
  return `export type ${pascalName} = {
  id: string;
  name: string;
  description?: string;
};
`;
}

function genericApiContent(name, pascalName) {
  return `import { apiClient } from "$shared/api";
import type { ${pascalName} } from "../model/${name}.types";

export async function get${pascalName}() {
  const { data } = await apiClient.get<${pascalName}>("/${name}");
  return data;
}

export async function update${pascalName}(payload: Partial<${pascalName}>) {
  const { data } = await apiClient.patch<${pascalName}>("/${name}", payload);
  return data;
}
`;
}

function genericQueryContent(name, camelName, pascalName) {
  return `import { createMutation, createQuery } from "@tanstack/svelte-query";
import { ${camelName}Keys } from "../lib/${name}.keys";
import { get${pascalName}, update${pascalName} } from "./${name}.api";

export function create${pascalName}Query() {
  return createQuery(() => ({
    queryKey: ${camelName}Keys.detail(),
    queryFn: get${pascalName},
  }));
}

export function createUpdate${pascalName}Mutation() {
  return createMutation(() => ({ mutationFn: update${pascalName} }));
}
`;
}

function keysContent(camelName, name) {
  return `export const ${camelName}Keys = {
  all: ["${name}"] as const,
  detail: () => [...${camelName}Keys.all, "detail"] as const,
};
`;
}

function svelteStoreContent(name, camelName, pascalName) {
  return `import { writable } from "svelte/store";
import type { ${pascalName}, ${pascalName}Status } from "./${name}.types";

type ${pascalName}State = {
  item: ${pascalName} | null;
  status: ${pascalName}Status;
};

const initialState: ${pascalName}State = { item: null, status: "idle" };

function create${pascalName}Store() {
  const { subscribe, set, update } = writable(initialState);
  return {
    subscribe,
    setItem: (item: ${pascalName}) =>
      update((state) => ({ ...state, item, status: "success" })),
    setStatus: (status: ${pascalName}Status) =>
      update((state) => ({ ...state, status })),
    reset: () => set(initialState),
  };
}

export const ${camelName}Store = create${pascalName}Store();
`;
}

function authTypesContent(authProvider) {
  return `export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthSession = { user: AuthUser; accessToken: string };
export type AuthActionResult = { message: string };
export type LoginCredentials = { email: string; password: string };
export type RegisterPayload = LoginCredentials & { name: string };
export type ForgotPasswordPayload = { email: string };
export type ResetPasswordPayload = ${authProvider === "supabase" ? "{ email: string; code: string; password: string; passwordConfirmation: string }" : "{ token: string; password: string }"};
export type VerifyCodePayload = { email: string; code: string };
`;
}

function authApiContent(form) {
  const functionName = toCamelCase(form.name);
  const resultType = ["login", "register"].includes(form.name)
    ? "AuthSession"
    : "AuthActionResult";
  return `import { apiClient } from "$shared/api";
import type { ${form.payload}, ${resultType} } from "../model/auth.types";

export async function ${functionName}(payload: ${form.payload}) {
  const { data } = await apiClient.post<${resultType}>("/auth/${form.name}", payload);
  return data;
}
`;
}

function authQueryContent() {
  const imports = AUTH_FORMS.map(
    (form) => `import { ${toCamelCase(form.name)} } from "./${form.name}.api";`
  );
  const mutations = AUTH_FORMS.map(
    (form) => `export function ${form.mutation}() {
  return createMutation(() => ({ mutationFn: ${toCamelCase(form.name)} }));
}`
  );
  return `import { createMutation } from "@tanstack/svelte-query";
${imports.join("\n")}

${mutations.join("\n\n")}
`;
}

function authKeysContent() {
  return `export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};
`;
}

function authStoreContent() {
  return `import { derived, writable } from "svelte/store";
import type { AuthSession, AuthUser } from "./auth.types";

export const authSession = writable<AuthSession | null>(null);
export const authUser = derived(authSession, ($session): AuthUser | null =>
  $session?.user ?? null
);
export const isAuthenticated = derived(authSession, Boolean);

export function setAuthSession(session: AuthSession) {
  authSession.set(session);
}

export function clearAuthSession() {
  authSession.set(null);
}
`;
}

function authSchemaContent(form) {
  const fields = form.fields.map(([name, , type]) => {
    if (name === "password") {
      return `  ${name}: z.string().min(8, "Password must contain at least 8 characters"),`;
    }
    if (type === "email") {
      return `  ${name}: z.email("Enter a valid email address"),`;
    }
    if (name === "code") {
      return `  ${name}: z.string().min(4, "Enter the verification code"),`;
    }
    return `  ${name}: z.string().min(1, "${toTitle(name)} is required"),`;
  });
  return `import { z } from "zod";

export const ${form.schema} = z.object({
${fields.join("\n")}
});
`;
}

function authFormContent(form, config) {
  return config.forms === "sveltekit-superforms-zod"
    ? superformContent(form)
    : simpleFormContent(form, config);
}

function superformContent(form) {
  const defaults = form.fields.map(([name]) => `    ${name}: "",`).join("\n");
  const fields = form.fields
    .map(
      ([name, label, type, autocomplete]) => `  <label>
    <span>${label}</span>
    <input
      name="${name}"
      type="${type}"
      autocomplete="${autocomplete}"
      bind:value={$form.${name}}
      aria-invalid={$errors.${name} ? "true" : undefined}
    />
    {#if $errors.${name}}
      <small>{$errors.${name}}</small>
    {/if}
  </label>`
    )
    .join("\n");

  return `<script lang="ts">
  import { defaults, superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import { ${form.schema} } from "../model/${form.name}.schema";

  const validator = zod4Client(${form.schema});
  const { form, errors, enhance, submitting } = superForm(
    defaults(
      {
${defaults}
      },
      validator
    ),
    { validators: validator }
  );
</script>

<form method="POST" use:enhance class="${form.name}-form">
${fields}
  <button type="submit" disabled={$submitting}>${form.submit}</button>
</form>
`;
}

function simpleFormContent(form, config) {
  const defaults = form.fields.map(([name]) => `    ${name}: "",`).join("\n");
  const fields = form.fields
    .map(
      ([name, label, type, autocomplete]) => `  <label>
    <span>${label}</span>
    <input
      name="${name}"
      type="${type}"
      autocomplete="${autocomplete}"
      bind:value={values.${name}}
    />
  </label>`
    )
    .join("\n");
  const mutationImport =
    config.serverState === "svelte-query"
      ? `import { ${form.mutation} } from "../api/auth.query";\n  `
      : "";
  const mutationSetup =
    config.serverState === "svelte-query"
      ? `const mutation = ${form.mutation}();\n  `
      : "";
  const mutationSubmit =
    config.serverState === "svelte-query"
      ? "\n    mutation.mutate({ ...values });"
      : "";

  return `<script lang="ts">
  ${mutationImport}import type { ${form.payload} } from "../model/auth.types";

  let { onSubmit }: { onSubmit?: (values: ${form.payload}) => void } = $props();
  ${mutationSetup}let values = $state<${form.payload}>({
${defaults}
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    onSubmit?.({ ...values });${mutationSubmit}
  }
</script>

<form class="${form.name}-form" onsubmit={submit}>
${fields}
  <button type="submit">${form.submit}</button>
</form>
`;
}

/**
 * The Svelte family generator, implementing the shared family generator
 * interface (see family-generators.mjs).
 */
export const svelteFamilyGenerator = Object.freeze({
  family: "svelte",
  createFilePlan: createSvelteFilePlan,
});
