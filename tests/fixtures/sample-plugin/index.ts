import type { PluginFactory, SafeFunction } from "../../../src";

const ping: SafeFunction = {
	name: "ping",
	handler: async () => "pong",
	description: "Returns pong.",
	requiredCredentials: [],
};

const createPlugin: PluginFactory = () => ({
	safeFunctions: [ping],
});

export default createPlugin;
