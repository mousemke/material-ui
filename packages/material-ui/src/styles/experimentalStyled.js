import styled from '@material-ui/styled-engine';
import { propsToClassKey } from '@material-ui/styles';
import { unstable_styleFunctionSx as styleFunctionSx } from '@material-ui/system';
import defaultTheme from './defaultTheme';

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

const getStyleOverrides = (name, theme) => {
  if (theme.components && theme.components[name] && theme.components[name].styleOverrides) {
    return theme.components[name].styleOverrides;
  }

  return null;
};

const getVariantStyles = (name, theme) => {
  let variants = [];
  if (theme && theme.components && theme.components[name] && theme.components[name].variants) {
    variants = theme.components[name].variants;
  }

  const variantsStyles = {};

  variants.forEach((definition) => {
    const key = propsToClassKey(definition.props);
    variantsStyles[key] = definition.style;
  });

  return variantsStyles;
};

const variantsResolver = (props, styles, theme, name) => {
  const { styleProps = {} } = props;
  let variantsStyles = {};
  const themeVariants = theme?.components?.[name]?.variants;
  if (themeVariants) {
    themeVariants.forEach((themeVariant) => {
      let isMatch = true;
      Object.keys(themeVariant.props).forEach((key) => {
        if (styleProps[key] !== themeVariant.props[key] && props[key] !== themeVariant.props[key]) {
          isMatch = false;
        }
      });
      if (isMatch) {
        variantsStyles = { ...variantsStyles, ...styles[propsToClassKey(themeVariant.props)] };
      }
    });
  }

  return variantsStyles;
};

export const shouldForwardProp = (prop) =>
  prop !== 'styleProps' &&
  prop !== 'theme' &&
  prop !== 'isRtl' &&
  prop !== 'sx' &&
  prop !== 'as' &&
  prop !== 'classes';

export const slotShouldForwardProp = (prop) =>
  prop !== 'styleProps' && prop !== 'theme' && prop !== 'isRtl' && prop !== 'sx' && prop !== 'as';

const lowercaseFirstLetter = (string) => {
  return string.charAt(0).toLowerCase() + string.slice(1);
};

const experimentalStyled = (tag, options, muiOptions = {}) => {
  const componentName = muiOptions.name;
  const componentSlot = muiOptions.slot;

  const overridesResolver = muiOptions.overridesResolver;
  // if skipVariantsResolver option is defined, take the value, otherwise, true for root and false for other slots
  const skipVariantsResolver =
    muiOptions.skipVariantsResolver !== undefined
      ? muiOptions.skipVariantsResolver
      : (componentSlot && componentSlot !== 'Root') || false;

  const skipSx = muiOptions.skipSx || false;

  let displayName;
  let className;

  if (componentName) {
    displayName = `${componentName}${componentSlot || ''}`;
    className = `${componentName}-${lowercaseFirstLetter(componentSlot || 'Root')}`;
  }

  const defaultStyledResolver = styled(tag, {
    ...(!componentSlot || componentSlot === 'Root'
      ? { shouldForwardProp }
      : { shouldForwardProp: slotShouldForwardProp }),
    label: className || componentName || '',
    ...options,
  });
  const muiStyledResolver = (styleArg, ...expressions) => {
    const expressionsWithDefaultTheme = expressions
      ? expressions.map((stylesArg) => {
          return typeof stylesArg === 'function'
            ? ({ theme: themeInput, ...other }) => {
                return stylesArg({
                  theme: isEmpty(themeInput) ? defaultTheme : themeInput,
                  ...other,
                });
              }
            : stylesArg;
        })
      : [];

    let transformedStyleArg = styleArg;

    if (componentName && overridesResolver) {
      expressionsWithDefaultTheme.push((props) => {
        const theme = isEmpty(props.theme) ? defaultTheme : props.theme;
        const styleOverrides = getStyleOverrides(componentName, theme);

        if (styleOverrides) {
          return overridesResolver(props, styleOverrides);
        }

        return null;
      });
    }

    if (componentName && overridesResolver && !skipVariantsResolver) {
      expressionsWithDefaultTheme.push((props) => {
        const theme = isEmpty(props.theme) ? defaultTheme : props.theme;
        return variantsResolver(
          props,
          getVariantStyles(componentName, theme),
          theme,
          componentName,
        );
      });
    }

    if (!skipSx) {
      expressionsWithDefaultTheme.push((props) => {
        const theme = isEmpty(props.theme) ? defaultTheme : props.theme;
        return styleFunctionSx({ ...props, theme });
      });
    }

    const numOfCustomFnsApplied = expressionsWithDefaultTheme.length - expressions.length;

    if (Array.isArray(styleArg) && numOfCustomFnsApplied > 0) {
      const placeholders = new Array(numOfCustomFnsApplied).fill('');
      // If the type is array, than we need to add placeholders in the template for the overrides, variants and the sx styles
      transformedStyleArg = [...styleArg, ...placeholders];
      transformedStyleArg.raw = [...styleArg.raw, ...placeholders];
    } else if (typeof styleArg === 'function') {
      // If the type is function, we need to define the default theme
      transformedStyleArg = ({ theme: themeInput, ...other }) =>
        styleArg({ theme: isEmpty(themeInput) ? defaultTheme : themeInput, ...other });
    }

    const Component = defaultStyledResolver(transformedStyleArg, ...expressionsWithDefaultTheme);

    if (displayName) {
      Component.displayName = displayName;
    }

    return Component;
  };
  return muiStyledResolver;
};

export default experimentalStyled;
