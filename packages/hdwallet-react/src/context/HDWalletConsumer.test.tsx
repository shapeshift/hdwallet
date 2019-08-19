/**
 * @jest-environment jsdom
 */

import React from "react";
import { HDWalletConsumer } from "./HDWalletConsumer";
import { HDWalletProvider } from "./HDWalletProvider";

import { render } from "@testing-library/react";

describe("<HDWalletConsumer /> component", () => {
  it("has a render prop", done => {
    render(
      <HDWalletProvider adapters={[]}>
        <HDWalletConsumer>
          {clientRender => {
            try {
              expect(clientRender).toEqual(
                expect.objectContaining({
                  getAdapter: expect.any(Function),
                  keyring: expect.any(Object),
                  pairedDevices: expect.any(Object)
                })
              );
              done();
            } catch (e) {
              done.fail(e);
            }
            return null;
          }}
        </HDWalletConsumer>
      </HDWalletProvider>
    );
  });
});
