package users
type User struct { ID int; Name string }
func GetUser(id int) User { return User{ID: id} }