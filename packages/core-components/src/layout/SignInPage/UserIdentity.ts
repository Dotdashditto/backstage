/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  IdentityApi,
  ProfileInfo,
  ProfileInfoApi,
  BackstageUserIdentity,
  BackstageIdentityApi,
  SessionApi,
  SignInResult,
} from '@backstage/core-plugin-api';

import { GuestUserIdentity } from './GuestUserIdentity';
import { LegacyUserIdentity } from './LegacyUserIdentity';

/**
 * An implementation of the IdentityApi that is constructed using
 * various backstage user identity representations.
 *
 * @public
 */
export class UserIdentity implements IdentityApi {
  /**
   * Creates a new IdentityApi that acts as a Guest User.
   *
   * @public
   */
  static createGuest(): IdentityApi {
    return new GuestUserIdentity();
  }

  /**
   * Creates a new IdentityApi using a legacy SignInResult object.
   *
   * @public
   */
  static fromLegacy(result: SignInResult): IdentityApi {
    return LegacyUserIdentity.fromResult(result);
  }

  /**
   * Creates a new IdentityApi implementation using a user identity
   * and an auth API that will be used to request backstage tokens.
   *
   * @public
   */
  static create(options: {
    identity: BackstageUserIdentity;
    authApi: ProfileInfoApi & BackstageIdentityApi & SessionApi;
    /**
     * Passing a profile synchronously allows the deprecated `getProfile` method to be
     * called by consumers of the {@link @backstage/core-plugin-api#IdentityApi}. If you
     * do not have any consumers of that method then this is safe to leave out.
     *
     * @deprecated Only provide this if you have plugins that call the synchronous `getProfile` method, which is also deprecated.
     */
    profile?: ProfileInfo;
  }): IdentityApi {
    return new UserIdentity(options.identity, options.authApi, options.profile);
  }

  private constructor(
    private readonly identity: BackstageUserIdentity,
    private readonly authApi: ProfileInfoApi &
      BackstageIdentityApi &
      SessionApi,
    private readonly profile?: ProfileInfo,
  ) {}

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getUserId} */
  getUserId(): string {
    const ref = this.identity.userEntityRef;
    const match = /^([^:/]+:)?([^:/]+\/)?([^:/]+)$/.exec(ref);
    if (!match) {
      throw new TypeError(`Invalid user entity reference "${ref}"`);
    }

    return match[3];
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getIdToken} */
  async getIdToken(): Promise<string | undefined> {
    const identity = await this.authApi.getBackstageIdentity();
    return identity!.token;
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getProfile} */
  getProfile(): ProfileInfo {
    if (!this.profile) {
      throw new Error(
        'The identity API does not implement synchronous profile fetching, use getProfileInfo() instead',
      );
    }
    return this.profile;
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getProfileInfo} */
  async getProfileInfo(): Promise<ProfileInfo> {
    const profile = await this.authApi.getProfile();
    return profile!;
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getBackstageIdentity} */
  async getBackstageIdentity(): Promise<BackstageUserIdentity> {
    return this.identity;
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.getCredentials} */
  async getCredentials(): Promise<{ token?: string | undefined }> {
    const identity = await this.authApi.getBackstageIdentity();
    return { token: identity!.token };
  }

  /** {@inheritdoc @backstage/core-plugin-api#IdentityApi.signOut} */
  async signOut(): Promise<void> {
    return this.authApi.signOut();
  }
}
