/** Old Navidrome declares no required flags, but its search needs all three values. */
export function missingSearchConfiguration(instance: Pick<IPlugin.IPluginDefine, "platform" | "userVariables">, values: Record<string, string>): boolean {
    return !!instance.userVariables?.some(variable => {
        const required = variable.required === true || (instance.platform === "Navidrome" && ["url", "username", "password"].includes(variable.key));
        return required && (typeof values[variable.key] !== "string" || !values[variable.key].trim());
    });
}
