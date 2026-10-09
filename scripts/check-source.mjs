import ts from 'typescript';

let run = 0;
export function moduleUrl(source) {
	const { outputText } = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	});
	return `data:text/javascript;base64,${Buffer.from(outputText + `\n// ${run++}`).toString('base64')}`;
}
