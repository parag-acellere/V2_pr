import { sendOauthRequest } from './../auth/auth.service';
import { getVisibility, GITHUB_API_URL, getOrganizationList } from './../../services/repository/github.service';
import * as log from './../../logs/logger';
import async from 'async';
import _ from 'lodash';
import {
    decryptStringWithAES, PROVIDER_MAP
} from './../../utils/common-functions';
import request from 'request';
import * as cf from './../../utils/common-functions';
const PAGE_LIMIT = 20;
export async function getUserInstallations(payload) {
    return new Promise((resolve, reject) => {
        const API_URL = `${GITHUB_API_URL}/user/installations`;
        let requestBody = {
            url: `${API_URL}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${payload.access_token}`,
                'User-Agent': 'Embold-Oauth'
            },
            rejectUnauthorized: false
        };
        sendOauthRequest(requestBody, 'installations')
            .then(body => {
                resolve(body);
            })
            .catch(error => {
                reject(error);
            });
    });
}

export async function getReposByOrg(payload) {
    return new Promise((resolve, reject) => {
        const API_URL = `${GITHUB_API_URL}/user/installations/${payload.installation_id}/repositories?per_page=100&page=${payload.page}`;
        let requestBody = {
            url: `${API_URL}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${payload.access_token}`,
                'User-Agent': 'Embold-Oauth'
            },
            rejectUnauthorized: false
        };
        sendOauthRequest(requestBody, 'installation_repos')
            .then(async body => {
                let repositories = body;
                if (body.repositories.length === 0 || payload.repositories_list.repositories.length >= body.total_count) {
                    return resolve(getRepositoryList(payload.integrated_repositories, payload.repositories_list, repositories, 'repositories'));
                } else {
                    payload.page += 1;
                    payload.repositories_list = await getRepositoryList(payload.integrated_repositories, payload.repositories_list, repositories, 'repositories');
                    return resolve(getReposByOrg(payload));
                }
            })
            .catch(error => {
                log.error(error);
                reject(error);
            });
    });
}


// prepare repository object array depending upon input key
function getRepositoryList(integratedRepositories, repositoriesList, list, key) {
    repositoriesList.totalCount = list.total_count;
    var ab;
    console.log("a");

    // common code to add repositories in list
    if (list.total_count > 0) {
        (list.repositories).forEach(repository => {
            // check duplicate repository name
            let branchPrefix = "refs/heads/";
            if (integratedRepositories.indexOf(repository.name) == -1) {
                let repoNode = {
                    'repoScmId': repository.id,
                    'name': repository.name,
                    'url': repository.html_url,
                    'visibility': getVisibility(repository.private, repository.fork),
                    "defaultLanguage": (repository.language !== null) ? repository.language : '',
                    'defaultBranch': {
                        name: (repository.default_branch !== null) ? repository.default_branch : '',
                        prefix: (repository.default_branch !== null) ? branchPrefix : '',
                        // commitId: (repository.default_branch !== null) ? repository.defaultBranchRef.target.abbreviatedOid : '',
                    },
                    "updatedOn": repository.updated_at,
                };
                (repositoriesList[key]).push(repoNode);
            }
        });

        return repositoriesList;
    } else {
        return repositoriesList;
    }
}

export function getOrgUsers(payload) {
    return new Promise((resolve, reject) => {
        const API_URL = `${GITHUB_API_URL}/orgs/${payload.orgSlug}/members?per_page=${PAGE_LIMIT}&page=${payload.page}`;
        let requestBody = {
            url: `${API_URL}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${payload.access_token}`,
                'User-Agent': 'Embold-Oauth'
            },
            rejectUnauthorized: false
        };
        request(requestBody, function (error, response, body) {
            if (error) {
                log.error(`Error while sending Oauth request : ${error}`);
                reject(new errors.CustomError("InternalServerError", "Something went wrong while sending request to remote", 500, 1034));
            } else if (response.statusCode == 200) {
                if (typeof body == 'string') {
                    body = JSON.parse(body);
                }
                
                let nextLink = (response.headers.link !== undefined && body.length > 0) ? response.headers.link : null;
                let nextPage = cf.extractLinks(nextLink);
                let lastPage = (nextLink !== null) ? ((nextPage['last'] !== undefined) ? nextPage['last'].page : payload.page) : 1;

                if (body.length > 0) {
                    payload.total_count = PAGE_LIMIT * lastPage;
                    async.eachSeries(body, async function (user, callback) {
                        let personalDetails = await getUserEmail(payload, user.url);
                        let userData = {
                            user_slug: user.login,
                            id: user.id,
                            avatar_url: user.avatar_url,
                            type: user.type,
                            url: user.url,
                            email: personalDetails.email,
                            name: personalDetails.name,
                            visibility: (payload.integrated_users.indexOf(String(user.id)) === -1) ? true : false
                        };
                        (payload.user_list).push(userData);
                        callback();

                    }, async function (err) {
                        if (err) {
                            log.error('error ' + err);
                            reject(new errors.CustomError("InternalServerError", "Something went wrong while sending request to remote", 500, 1034));
                        } else {
                            return resolve(payload);
                        }
                    });
                } else {
                    return resolve(payload);
                }
            }
        });
    });
}

function getUserEmail(payload, url) {
    return new Promise((resolve, reject) => {
        let requestBody = {
            url: `${url}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${payload.access_token}`,
                'User-Agent': 'Embold-Oauth'
            },
            rejectUnauthorized: false
        };
        sendOauthRequest(requestBody, 'user_email')
            .then(body => {
                resolve(body);
            })
            .catch(error => {
                log.error(error);
                reject(error);
            });
    });
}

export async function getOrgMemebershipForUser(payload) {
    return new Promise((resolve, reject) => {
        const API_URL = `${GITHUB_API_URL}/user/memberships/orgs/${payload.slug}`;
        let requestBody = {
            url: `${API_URL}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${payload.access_token}`,
                'User-Agent': 'Embold-Oauth'
            },
            rejectUnauthorized: false
        };
        sendOauthRequest(requestBody, 'memberships')
            .then(body => {
                return resolve(body);
            })
            .catch(error => {
                let errStatusCode = (!_.isUndefined(error.statusCode)) ? error.statusCode : '';
                if (_.includes(['404', 404], errStatusCode)) {
                    log.info(`User membership for personal account ${payload.slug} not found.`);
                } else {
                    log.error(`User membership api ${API_URL} failed due to: ${error}`);
                }
                return reject(error);
            });
    });
}

export async function getOrganizations(params) {
    return new Promise(async (resolve, reject) => {
        let metadata = {
            profile: {
                name: '',
                avatar: ''
            },
        };
        let limit = 100;
        let accessToken = decryptStringWithAES(params.auth_meta['scm'].access_token);

        metadata.profile.name = '';
        metadata.profile.avatar = '';
        metadata.organizationList = [];
        await getOrganizationList(metadata, accessToken, limit);
        resolve(metadata.organizationList);
    });
}