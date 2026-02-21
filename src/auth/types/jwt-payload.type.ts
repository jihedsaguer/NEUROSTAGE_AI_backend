import { Role } from "src/modules/roles/entities/role.entity";

export type JwtPayload = {
    sub: string ; 
    email: string ;
    roles: Role[] ;
}
