import { ts, TransformationContext } from '@elements/compiler';

/**
 * Transforms is('server') and is('browser') statements by removing the
 * conditional block that is not intended for the specified build target. For
 * example, the statement: `if (is('server')) { ... } else { ... }` will strip
 * out the server block for the code compiled for the browser, and will strip out
 * the browser block for the code compiled for the server.
 *
 */
export function buildTargetTransform(ast: ts.SourceFile, ctx: TransformationContext): ts.SourceFile | undefined {
  function visit(node: ts.Node): ts.Node | undefined {
    if (isBuildTargetConditionalIfStatement(node)) {
      return transformBuildTargetConditionalIfStatement(node, ctx);
    } else {
      return ts.visitEachChild(node, visit, ctx as ts.TransformationContext);
    }
  }

  return visit(ast);
}

function transformBuildTargetConditionalIfStatement(node: ts.Node, ctx: TransformationContext): ts.Node {
  let target = getBuildTargetFromCallExpression(node.expression);
  if (target == ctx.getTarget().name) {
    return node.thenStatement;
  } else {
    return node.elseStatement;
  }
}

function isBuildTargetConditionalIfStatement(node: ts.Node): boolean {
  if (node.kind == ts.SyntaxKind.IfStatement) {
    if (node.expression.kind == ts.SyntaxKind.CallExpression) {
      let call = node.expression;
      if (call.expression.escapedText == 'is') {
        return true;
      }
    }
  }

  return false;
}

function getBuildTargetFromCallExpression(node: ts.Node): string {
  if (node.expression.escapedText == 'is') {
    if (node.arguments.length > 0) {
      let target = node.arguments[0].text;
      return target == 'server' ? 'main' : target;
    }
  }
  return '';
}
