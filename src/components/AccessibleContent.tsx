"use client";
import { useLanguage } from "./language";
import { createElement, useId } from "react";

export type MathNode =
  | { tag: "mi" | "mn" | "mo" | "mtext"; text: string }
  | { tag: "mrow" | "mfrac" | "msup" | "msub" | "msqrt"; children: MathNode[] };
function mathTree(node: MathNode, index = 0): React.ReactNode {
  return createElement(
    node.tag,
    { key: index },
    "text" in node ? node.text : node.children.map(mathTree),
  );
}
export function AccessibleEquation({
  equation,
  description,
}: {
  equation: MathNode;
  description: string;
}) {
  const { t } = useLanguage();
  const id = useId();
  return (
    <figure className="semantic-equation">
      {t(
        createElement(
          "math",
          {
            xmlns: "http://www.w3.org/1998/Math/MathML",
            display: "block",
            "aria-describedby": id,
          },
          mathTree(equation),
        ),
      )}
      <figcaption id={id}>{t(description)}</figcaption>
    </figure>
  );
}
export function AccessibleChart({
  title,
  description,
  columns,
  rows,
  image,
  update,
}: {
  title: string;
  description: string;
  columns: string[];
  rows: (string | number)[][];
  image?: { src: string; alt: string };
  update?: string;
}) {
  const { t } = useLanguage();
  const id = useId();
  return (
    <figure className="semantic-chart">
      <figcaption id={`${id}-title`}>
        <strong>{t(title)}</strong>
      </figcaption>
      <p id={`${id}-description`}>{t(description)}</p>
      {image && (
        <img
          src={image.src}
          alt={t(image.alt)}
          aria-describedby={`${id}-description ${id}-table`}
        />
      )}
      <div className="table-wrap">
        <table id={`${id}-table`} aria-describedby={`${id}-description`}>
          <caption>
            {t(title)} {t(" — complete data")}
          </caption>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th scope="col" key={index}>
                  {t(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, col) =>
                  col === 0 ? (
                    <th scope="row" key={col}>
                      {t(cell)}
                    </th>
                  ) : (
                    <td key={col}>{t(cell)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t(update || "")}
      </p>
    </figure>
  );
}
