import {
  file,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toTitle,
} from "./shared.mjs";
import {
  isWidgetPreset,
  vueWidgetPresetComponent,
  vueWidgetPresetContent,
} from "./widget-presets.mjs";
import { isPagePreset, vuePagePresetContent } from "./page-presets.mjs";

const AUTH_FORMS = [
  {
    name: "login",
    component: "LoginForm",
    payload: "LoginCredentials",
    schema: "loginSchema",
    mutation: "useLoginMutation",
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
    mutation: "useRegisterMutation",
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
    mutation: "useForgotPasswordMutation",
    submit: "Send reset code",
    fields: [["email", "Email", "email", "email"]],
  },
  {
    name: "reset-password",
    component: "ResetPasswordForm",
    payload: "ResetPasswordPayload",
    schema: "resetPasswordSchema",
    mutation: "useResetPasswordMutation",
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
    mutation: "useVerifyCodeMutation",
    submit: "Verify code",
    fields: [
      ["email", "Email", "email", "email"],
      ["code", "Verification code", "text", "one-time-code"],
    ],
  },
];

export function createVueFilePlan(type, name, config) {
  if (type === "feature") {
    return name === "auth"
      ? createVueAuthFiles(config)
      : createVueFeatureFiles(name, config);
  }
  if (type === "entity") return createVueEntityFiles(name);
  if (type === "widget") return createVueWidgetFiles(name, config);
  return createVuePageFiles(name);
}

function createVueFeatureFiles(name, config) {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const files = [
    file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
    vueComponent(
      `ui/${pascalName}View.vue`,
      `${pascalName}View`,
      viewContent(`${toTitle(name)} feature`)
    ),
  ];

  if (config.serverState === "vue-query") {
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
  if (config.clientState === "pinia") {
    files.push(
      file(
        `model/${name}.store.ts`,
        piniaStoreContent(name, camelName, pascalName),
        true
      ),
      file(`lib/${name}.helpers.ts`, helpersContent(name, pascalName), true)
    );
  }
  return files;
}

function createVueEntityFiles(name) {
  const pascalName = toPascalCase(name);
  return [
    file(`model/${name}.types.ts`, entityTypesContent(pascalName), true),
    vueComponent(
      `ui/${pascalName}Card.vue`,
      `${pascalName}Card`,
      entityCardContent(name, pascalName)
    ),
  ];
}

function createVueWidgetFiles(name, config) {
  if (isWidgetPreset(name)) {
    const componentName = vueWidgetPresetComponent(name);
    return [
      vueComponent(
        `ui/${componentName}.vue`,
        componentName,
        vueWidgetPresetContent(name, config)
      ),
    ];
  }
  const componentName = toPascalCase(name);
  return [
    vueComponent(
      `ui/${componentName}.vue`,
      componentName,
      viewContent(`${toTitle(name)} widget`)
    ),
  ];
}

function createVuePageFiles(name) {
  const componentName = `${toPascalCase(name)}Page`;
  return [
    vueComponent(
      `ui/${componentName}.vue`,
      componentName,
      isPagePreset(name)
        ? vuePagePresetContent(name)
        : viewContent(`${toTitle(name)} page`)
    ),
  ];
}

function createVueAuthFiles(config) {
  const forms = AUTH_FORMS.map(form => config.authProvider === "supabase" && form.name === "reset-password" ? {
    ...form, fields: [
      ["email", "Email", "email", "email"],
      ["code", "Recovery code", "text", "one-time-code"],
      ["password", "New password", "password", "new-password"],
      ["passwordConfirmation", "Confirm password", "password", "new-password"],
    ],
  } : form);
  const files = [file("model/auth.types.ts", authTypesContent(config.authProvider), true)];

  if (config.serverState === "vue-query") {
    files.push(
      ...forms.map((form) =>
        file(`api/${form.name}.api.ts`, authApiContent(form), false)
      ),
      file("api/auth.query.ts", authQueryContent(), true),
      file("lib/auth.keys.ts", authKeysContent(), true)
    );
  }
  if (config.clientState === "pinia") {
    files.push(file("model/auth.store.ts", authStoreContent(), true));
  }
  if (config.forms === "vee-validate-zod") {
    files.push(
      ...forms.map((form) =>
        file(`model/${form.name}.schema.ts`, authSchemaContent(form), true)
      )
    );
  }
  files.push(
    ...forms.map((form) =>
      vueComponent(
        `ui/${form.component}.vue`,
        form.component,
        authFormContent(form, config)
      )
    )
  );
  return files;
}

function vueComponent(pathname, exportName, content) {
  return {
    ...file(pathname, content, true),
    exportLine: `export { default as ${exportName} } from "./${pathname}";`,
  };
}

function viewContent(title) {
  return `<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), {
  title: "${title}",
});
</script>

<template>
  <section>
    <h2>{{ title }}</h2>
  </section>
</template>
`;
}

function entityCardContent(name, pascalName) {
  const propertyName = toCamelCase(name);
  return `<script setup lang="ts">
import type { ${pascalName} } from "../model/${name}.types";

defineProps<{ ${propertyName}: ${pascalName} }>();
</script>

<template>
  <article>
    <h3>{{ ${propertyName}.name }}</h3>
    <p v-if="${propertyName}.description">
      {{ ${propertyName}.description }}
    </p>
  </article>
</template>
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
`;
}

function genericQueryContent(name, camelName, pascalName) {
  return `import { useMutation, useQuery } from "@tanstack/vue-query";
import { ${camelName}Keys } from "../lib/${name}.keys";
import { get${pascalName}, update${pascalName} } from "./${name}.api";

export function use${pascalName}Query() {
  return useQuery({ queryKey: ${camelName}Keys.detail(), queryFn: get${pascalName} });
}

export function useUpdate${pascalName}Mutation() {
  return useMutation({ mutationFn: update${pascalName} });
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

function piniaStoreContent(name, camelName, pascalName) {
  return `import { defineStore } from "pinia";
import { ref } from "vue";
import type { ${pascalName}, ${pascalName}Status } from "./${name}.types";

export const use${pascalName}Store = defineStore("${camelName}", () => {
  const item = ref<${pascalName} | null>(null);
  const status = ref<${pascalName}Status>("idle");

  function reset() {
    item.value = null;
    status.value = "idle";
  }

  return { item, status, reset };
});
`;
}

function helpersContent(name, pascalName) {
  return `import type { ${pascalName} } from "../model/${name}.types";

export function has${pascalName}(item: ${pascalName} | null): item is ${pascalName} {
  return Boolean(item);
}

export function get${pascalName}Label(item: ${pascalName}) {
  return item.name;
}
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
  return `import { apiClient } from "@/shared/api";
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
  const hooks = AUTH_FORMS.map(
    (form) => `export function ${form.mutation}() {
  return useMutation({ mutationFn: ${toCamelCase(form.name)} });
}`
  );
  return `import { useMutation } from "@tanstack/vue-query";
${imports.join("\n")}

${hooks.join("\n\n")}
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
  return `import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { AuthSession, AuthUser } from "./auth.types";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const isAuthenticated = computed(() => Boolean(accessToken.value));

  function setSession(session: AuthSession) {
    user.value = session.user;
    accessToken.value = session.accessToken;
  }

  function logout() {
    user.value = null;
    accessToken.value = null;
  }

  return { user, accessToken, isAuthenticated, setSession, logout };
});
`;
}

function authSchemaContent(form) {
  const fields = form.fields.map(([name, , type]) => {
    if (name === "password") {
      return `  ${name}: z.string().min(8, "Password must contain at least 8 characters"),`;
    }
    if (type === "email") {
      return `  ${name}: z.string().email("Enter a valid email address"),`;
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
  return config.forms === "vee-validate-zod"
    ? validatedAuthFormContent(form, config)
    : simpleAuthFormContent(form, config);
}

function validatedAuthFormContent(form, config) {
  const mutationImport =
    config.serverState === "vue-query"
      ? `import { ${form.mutation} } from "../api/auth.query";\n`
      : "";
  const mutationSetup =
    config.serverState === "vue-query"
      ? `const mutation = ${form.mutation}();\n`
      : "";
  const mutationSubmit =
    config.serverState === "vue-query" ? "\n  mutation.mutate(values);" : "";
  const fieldsSetup = form.fields
    .map(
      ([name]) =>
        `const { value: ${name} } = useField<${fieldType(name)}>("${name}");`
    )
    .join("\n");
  const fieldMarkup = form.fields
    .map(
      ([name, label, type, autocomplete]) => `    <label>
      <span>${label}</span>
      <input
        v-model="${name}"
        type="${type}"
        autocomplete="${autocomplete}"
      >
      <small v-if="errors.${name}">{{ errors.${name} }}</small>
    </label>`
    )
    .join("\n");

  return `<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useField, useForm } from "vee-validate";
${mutationImport}import { ${form.schema} } from "../model/${form.name}.schema";
import type { ${form.payload} } from "../model/auth.types";

const emit = defineEmits<{ submit: [values: ${form.payload}] }>();
${mutationSetup}const { errors, handleSubmit, isSubmitting } = useForm<${form.payload}>({
  validationSchema: toTypedSchema(${form.schema}),
});
${fieldsSetup}

const submit = handleSubmit((values) => {
  emit("submit", values);${mutationSubmit}
});
</script>

<template>
  <form
    class="${form.name}-form"
    @submit.prevent="submit"
  >
${fieldMarkup}
    <button
      type="submit"
      :disabled="isSubmitting"
    >
      ${form.submit}
    </button>
  </form>
</template>
`;
}

function simpleAuthFormContent(form, config) {
  const defaults = form.fields
    .map(([name]) => `  ${name}: "",`)
    .join("\n");
  const fieldMarkup = form.fields
    .map(
      ([name, label, type, autocomplete]) => `    <label>
      <span>${label}</span>
      <input
        v-model="values.${name}"
        type="${type}"
        autocomplete="${autocomplete}"
      >
    </label>`
    )
    .join("\n");
  const mutationImport =
    config.serverState === "vue-query"
      ? `import { ${form.mutation} } from "../api/auth.query";\n`
      : "";
  const mutationSetup =
    config.serverState === "vue-query"
      ? `const mutation = ${form.mutation}();\n`
      : "";
  const mutationSubmit =
    config.serverState === "vue-query" ? "\n  mutation.mutate(values);" : "";

  return `<script setup lang="ts">
import { reactive } from "vue";
${mutationImport}import type { ${form.payload} } from "../model/auth.types";

const emit = defineEmits<{ submit: [values: ${form.payload}] }>();
${mutationSetup}const values = reactive<${form.payload}>({
${defaults}
});

function submit() {
  emit("submit", values);${mutationSubmit}
}
</script>

<template>
  <form
    class="${form.name}-form"
    @submit.prevent="submit"
  >
${fieldMarkup}
    <button type="submit">
      ${form.submit}
    </button>
  </form>
</template>
`;
}

function fieldType(name) {
  return ["email", "password", "name", "token", "code"].includes(name)
    ? "string"
    : "unknown";
}

/**
 * The Vue family generator, implementing the shared family generator
 * interface (see family-generators.mjs).
 */
export const vueFamilyGenerator = Object.freeze({
  family: "vue",
  createFilePlan: createVueFilePlan,
});
